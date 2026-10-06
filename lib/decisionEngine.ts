import { enqueueJob, type AgentJob, type JobKind } from "./controlPlane";
import { readDB } from "./store";
import { recordDecision, attachDecisionJob, getDecisionLearning } from "./decisionMemory";

export type DecisionAction = "discover"|"build"|"outreach"|"follow_up"|"measurement"|"recover"|"wait"|"approve";
export interface DecisionCandidate { action:DecisionAction; score:number; reason:string; jobKind?:JobKind; opportunityId?:string; leadId?:string; requiresApproval?:boolean; }
export interface Decision { missionId:string; selected?:DecisionCandidate; candidates:DecisionCandidate[]; rationale:string; generatedAt:string; decisionId?:string; }

function hasPendingJob(jobs:AgentJob[], missionId:string, kind:JobKind, opportunityId?:string) {
  return jobs.some(j=>j.missionId===missionId && j.kind===kind && ["queued","running","retrying","blocked"].includes(j.status) && (!opportunityId || j.opportunityId===opportunityId));
}

export async function decideNextAction(missionId:string):Promise<Decision> {
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
    const best=fresh.sort((a,b)=>b.score-a.score)[0];
    candidates.push({action:"build",score:85+Math.min(10,best.score/10),reason:`High-value unworked opportunity: ${best.businessName}`,jobKind:"build",opportunityId:best.id});
  }

  const contacted=db.leads.filter(l=>l.status==="new"&&l.email&&(!l.nextFollowUpAt||Date.parse(l.nextFollowUpAt)<=Date.now()));
  if(contacted.length&&!hasPendingJob(jobs,missionId,"follow_up")) {
    candidates.push({action:"follow_up",score:82,reason:`${contacted.length} lead(s) are eligible for response/follow-up`,jobKind:"follow_up"});
  }

  const withEmail=db.opportunities.filter(o=>o.contactEmail&&o.status==="qualified");
  if(withEmail.length&&!hasPendingJob(jobs,missionId,"outreach")) {
    const best=withEmail.sort((a,b)=>b.score-a.score)[0];
    candidates.push({action:"outreach",score:78+Math.min(10,best.score/10),reason:`Qualified opportunity has a reachable contact: ${best.businessName}`,jobKind:"outreach",opportunityId:best.id,requiresApproval:true});
  }

  if(db.revenue.some(r=>r.type==="won")||db.deals.length) candidates.push({action:"measurement",score:70,reason:"New deal/revenue outcomes can update mission economics",jobKind:"measurement"});

  if(!candidates.length) candidates.push({action:"discover",score:60,reason:"No higher-value executable action is currently available",jobKind:"discovery"});

  const learning=await getDecisionLearning();
  for(const candidate of candidates){ const l=learning.byAction[candidate.action]; if(l?.resolved>=3) candidate.score=Math.max(0,Math.min(100,candidate.score + Math.max(-10,Math.min(10,(l.successRate-0.5)*12)) + Math.max(-8,Math.min(8,l.averageReward*2)))); }
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
  const job=await enqueueJob({kind:c.jobKind,missionId,opportunityId:c.opportunityId,leadId:c.leadId,payload:{decision:c.action,reason:c.reason,decisionId:memory.id},idempotencyKey:`decision:${missionId}:${c.action}:${c.opportunityId||"global"}`,maxAttempts:3,runAfter:new Date().toISOString()});
  await attachDecisionJob(memory.id,job.id);
  return {...decision,decisionId:memory.id};
}
