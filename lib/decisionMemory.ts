import { id } from "./id";
import { readDB, updateDB } from "./store";
import type { AgentJob } from "./controlPlane";

export type DecisionOutcome = "pending"|"succeeded"|"failed"|"skipped";
export interface DecisionMemory {
  id:string; missionId:string; action:string; score:number; reason:string;
  candidateActions:string[]; selected:boolean; jobId?:string; opportunityId?:string; leadId?:string;
  baselineWonRevenue:number; outcome:DecisionOutcome; reward:number; revenueDelta:number;
  createdAt:string; resolvedAt?:string;
}
type MemoryDB = Awaited<ReturnType<typeof readDB>> & { decisionMemory?:DecisionMemory[] };
function memory(db:Awaited<ReturnType<typeof readDB>>):MemoryDB { const d=db as MemoryDB; d.decisionMemory ??=[]; return d; }

export async function recordDecision(input:Omit<DecisionMemory,"id"|"createdAt">) {
  return updateDB(db=>{const d=memory(db);const item:DecisionMemory={...input,id:id("decision"),createdAt:new Date().toISOString()};d.decisionMemory!.unshift(item);return item;});
}
export async function attachDecisionJob(decisionId:string,jobId:string) {
  return updateDB(db=>{const d=memory(db);const x=d.decisionMemory!.find(v=>v.id===decisionId);if(x)x.jobId=jobId;return x;});
}
export async function resolveDecisionForJob(job:AgentJob,outcome:"succeeded"|"failed",currentWonRevenue?:number) {
  return updateDB(db=>{const d=memory(db);const x=d.decisionMemory!.find(v=>v.jobId===job.id&&v.outcome==="pending");if(!x)return undefined;const revenueDelta=Math.max(0,(currentWonRevenue??x.baselineWonRevenue)-x.baselineWonRevenue);x.outcome=outcome;x.revenueDelta=revenueDelta;x.reward=outcome==="succeeded"?1+Math.min(revenueDelta/10000,10):-1;x.resolvedAt=new Date().toISOString();return x;});
}
export async function reconcilePendingDecisions() {
  return updateDB(db=>{ const d=memory(db); for(const x of d.decisionMemory!){ if(x.outcome!=="pending"||!x.opportunityId) continue; const revenue=db.revenue.filter(r=>r.type==="won"&&r.opportunityId===x.opportunityId).reduce((s,r)=>s+r.amount,0); if(revenue>0){ x.outcome="succeeded"; x.revenueDelta=revenue; x.reward=1+Math.min(revenue/10000,10); x.resolvedAt=new Date().toISOString(); } } return d.decisionMemory!; });
}

export async function getDecisionLearning() {
  const db=memory(await readDB()), all=db.decisionMemory!, byAction:Record<string,{decisions:number;resolved:number;successRate:number;averageReward:number;revenueDelta:number}>={};
  for(const x of all){const s=byAction[x.action]??={decisions:0,resolved:0,successRate:0,averageReward:0,revenueDelta:0};s.decisions++;if(x.outcome!=="pending"){s.resolved++;s.successRate+=x.outcome==="succeeded"?1:0;s.averageReward+=x.reward;s.revenueDelta+=x.revenueDelta;}}
  for(const s of Object.values(byAction)){if(s.resolved){s.successRate/=s.resolved;s.averageReward/=s.resolved;s.revenueDelta/=s.resolved;}}
  return {totalDecisions:all.length,byAction,recent:all.slice(0,25)};
}