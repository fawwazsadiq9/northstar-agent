import { enqueueJob, type AgentJob, type JobKind } from "./controlPlane";
import { readDB } from "./store";
import { recordDecision, attachDecisionJob, getDecisionLearning } from "./decisionMemory";
import { strategyPerformance } from "./strategy";
import { selectContextualStrategy } from "./strategyOptimizer";
import { scoreOpportunity } from "./economicOptimizer";
import { getMultiPeriodCapitalPlan, optimizeMultiPeriodCapital, type MultiPeriodPlan } from "./multiPeriodCapital";
import { replanMission } from "./closedLoop";

export type DecisionAction = "discover"|"build"|"outreach"|"follow_up"|"measurement"|"recover"|"wait"|"approve";
export interface DecisionCandidate { action:DecisionAction; score:number; reason:string; jobKind?:JobKind; opportunityId?:string; leadId?:string; requiresApproval?:boolean; }
export interface Decision { missionId:string; selected?:DecisionCandidate; candidates:DecisionCandidate[]; rationale:string; generatedAt:string; decisionId?:string; }

function hasPendingJob(jobs:AgentJob[], missionId:string, kind:JobKind, opportunityId?:string) {
  return jobs.some(j=>j.missionId===missionId && j.kind===kind && ["queued","running","retrying","blocked"].includes(j.status) && (!opportunityId || j.opportunityId===opportunityId));
}

async function rollingPlan(missionId:string):Promise<MultiPeriodPlan> {
  const existing=await getMultiPeriodCapitalPlan(missionId);
  return existing ?? optimizeMultiPeriodCapital(missionId);
}

export async function decideNextAction(missionId:string):Promise<Decision> {
  await replanMission(missionId, "manual");
  const db=await readDB();
  const jobs=((db as typeof db & {jobs?:AgentJob[]}).jobs)||[];
  const nodes=((db as typeof db & {missionNodes?:Array<{id:string;missionId:string;kind:string;status:string;opportunityId?:string;approvalRequired?:boolean}>}).missionNodes)||[];
  const mission=db.missions.find(m=>m.id===missionId);
  if(!mission) throw new Error("Mission not found");

  const candidates:DecisionCandidate[]=[];
  const failed=jobs.filter(j=>j.missionId===missionId&&j.status==="failed");
  if(failed.length) candidates.push({action:"recover",score:92,reason:`${failed.length} job(s) exhausted retries and need recovery review`});

  const blocked=nodes.filter(n=>n.missionId===missionId&&n.status==="blocked");
  if(blocked.length) candidates.push({action:"approve",score:96,reason:"A mission stage is waiting for human approval",requiresApproval:true});

  const fresh=db.opportunities.filter(o=>o.status==="new"&&!db.leads.some(l=>l.opportunityId===o.id));
  if(fresh.length&&!hasPendingJob(jobs,missionId,"build")) {
    const rolling=await rollingPlan(missionId);
    const ranked={ranked:rolling.allocations.map(a=>({opportunityId:a.opportunityId,economicScore:Math.min(100,a.score),expectedValue:a.expectedValue,expectedCashVelocity:a.expectedCash,strategyVariantId:a.strategyVariantId,period:a.period,exploration:a.exploration}))};
    const allowed=new Set(ranked.ranked.map(x=>x.opportunityId));
    const best=fresh.filter(o=>allowed.has(o.id)).sort((a,b)=>{
      const ae=ranked.ranked.find(x=>x.opportunityId===a.id)?.economicScore||0;
      const be=ranked.ranked.find(x=>x.opportunityId===b.id)?.economicScore||0;
      return be-ae;
    })[0];
    if(best){
      const economics=ranked.ranked.find(x=>x.opportunityId===best.id);
      candidates.push({action:"build",score:Math.min(100,55+(economics?.economicScore||best.score)*.45),reason:"Rolling-horizon capital priority: "+best.businessName+" — expected value $"+(economics?.expectedValue||0).toFixed(0)+", cash velocity $"+(economics?.expectedCashVelocity||0).toFixed(0)+"/day",jobKind:"build",opportunityId:best.id});
    }
  }

  const contacted=db.leads.filter(l=>l.status==="new"&&l.email&&(!l.nextFollowUpAt||Date.parse(l.nextFollowUpAt)<=Date.now()));
  if(contacted.length&&!hasPendingJob(jobs,missionId,"follow_up")) {
    candidates.push({action:"follow_up",score:82,reason:`${contacted.length} lead(s) are eligible for response/follow-up`,jobKind:"follow_up"});
  }

  const withEmail=db.opportunities.filter(o=>o.contactEmail&&o.status==="qualified");
  if(withEmail.length&&!hasPendingJob(jobs,missionId,"outreach")) {
    const rolling=await rollingPlan(missionId);
    const ranked=rolling.allocations.filter(a=>withEmail.some(o=>o.id===a.opportunityId));
    const best=ranked.sort((a,b)=>b.score-a.score)[0];
    if(best){
      candidates.push({action:"outreach",score:Math.min(100,55+best.score*.45),reason:"Rolling-horizon capital priority: "+best.businessName+" — expected value $"+best.expectedValue.toFixed(0)+", expected cash $"+best.expectedCash.toFixed(0)+", period "+best.period,jobKind:"outreach",opportunityId:best.opportunityId,requiresApproval:true});
    }
  }

  if(db.revenue.some(r=>r.type==="won")||db.deals.length) candidates.push({action:"measurement",score:70,reason:"New deal/revenue outcomes can update mission economics",jobKind:"measurement"});

  if(!candidates.length) candidates.push({action:"discover",score:60,reason:"No higher-value executable action is currently available",jobKind:"discovery"});

  const learning=await getDecisionLearning();
  const strategies=await strategyPerformance();
  for(const candidate of candidates){ const l=learning.byAction[candidate.action]; if(l?.resolved>=3) candidate.score=Math.max(0,Math.min(100,candidate.score + Math.max(-10,Math.min(10,(l.successRate-0.5)*12)) + Math.max(-8,Math.min(8,l.averageReward*2)))); }
  for(const candidate of candidates){ const matches=strategies.filter(s=>s.variant.context.channel===candidate.action); if(matches.length){ const best=Math.max(...matches.map(s=>s.winRate)); if(best>0.5) candidate.score=Math.min(100,candidate.score+(best-0.5)*10); } }
  for(const candidate of candidates){ if(candidate.action==="build"||candidate.action==="outreach"||candidate.action==="follow_up"){ const strategy=await selectContextualStrategy(missionId,candidate.action,candidate.opportunityId,candidate.leadId); if(strategy){ candidate.score=Math.min(100,candidate.score+(strategy.score-0.5)*5); candidate.reason+=` Strategy: ${strategy.variant.name} — ${strategy.rationale}`; } } }
  candidates.sort((a,b)=>b.score-a.score);
  const selected=candidates[0];
  return {missionId,selected,candidates,rationale:`Selected ${selected.action} because it has the highest current execution value under Northstar's safety and dependency constraints.`,generatedAt:new Date().toISOString()};
}

export async function executeDecision(missionId:string):Promise<Decision> {
  const decision=await decideNextAction(missionId);
  const c=decision.selected;
  const db=await readDB();
  const baselineWonRevenue=db.revenue.filter(r=>r.type==="won").reduce((s,r)=>s+r.amount,0);
  const memory=await recordDecision({missionId,action:c?.action||"wait",score:c?.score||0,reason:c?.reason||"No action",candidateActions:decision.candidates.map(x=>x.action),selected:true,opportunityId:c?.opportunityId,leadId:c?.leadId,baselineWonRevenue,outcome:"pending",reward:0,revenueDelta:0});
  if(!c||!c.jobKind||c.requiresApproval) return {...decision,decisionId:memory.id};
  const rolling= c.opportunityId ? (await rollingPlan(missionId)).allocations.find(a=>a.opportunityId===c.opportunityId) : undefined;
  const strategy=(c.action==="build"||c.action==="outreach"||c.action==="follow_up") ? await selectContextualStrategy(missionId,c.action,c.opportunityId,c.leadId) : null;
  const job=await enqueueJob({kind:c.jobKind,missionId,opportunityId:c.opportunityId,leadId:c.leadId,payload:{decision:c.action,reason:c.reason,decisionId:memory.id,strategyExperimentId:strategy?.experimentId,strategyVariantId:rolling?.strategyVariantId||strategy?.variant.id,strategyContext:strategy?.context,strategyRationale:strategy?.rationale,rollingCapitalScore:rolling?.score,rollingCapitalPeriod:rolling?.period,rollingCapitalExploration:rolling?.exploration},idempotencyKey:`decision:${missionId}:${c.action}:${c.opportunityId||"global"}`,maxAttempts:3,runAfter:new Date().toISOString()});
  await attachDecisionJob(memory.id,job.id);
  return {...decision,decisionId:memory.id};
}
