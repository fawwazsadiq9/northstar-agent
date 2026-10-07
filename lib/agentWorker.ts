import { audit } from "./audit";
import { completeJob, failJob, claimJobs, recordToolExecution, finishToolExecution, type AgentJob } from "./controlPlane";
import { discoverOpportunities } from "./discovery";
import { draftOutreach, generateWebsite } from "./operator";
import { advanceMissionGraph } from "./missionGraph";

import { readDB, updateDB } from "./store";
import { resolveDecisionForJob } from "./decisionMemory";
import { recordStrategyObservation } from "./strategy";
import { replanMission } from "./closedLoop";

async function executeTool(job:AgentJob, tool:string, input:Record<string,unknown>, fn:()=>Promise<Record<string,unknown>>) {
  const execution=await recordToolExecution({jobId:job.id,tool,status:"running",input});
  try {
    const output=await fn();
    await finishToolExecution(execution.id,true,output);
    return output;
  } catch(error) {
    const message=error instanceof Error?error.message:"Tool execution failed";
    await finishToolExecution(execution.id,false,undefined,message);
    throw error;
  }
}

async function markNode(job:AgentJob,status:"running"|"succeeded"|"failed") { if(!job.payload.nodeId) return; await updateDB(db=>{ const nodes=(db as typeof db & {missionNodes?:Array<{id:string;status:string}>}).missionNodes||[]; const n=nodes.find(x=>x.id===String(job.payload.nodeId)); if(n)n.status=status; }); }

async function executeJob(job:AgentJob):Promise<Record<string,unknown>> {
  switch(job.kind) {
    case "mission": {
      if(!job.missionId) throw new Error("Mission job requires missionId");
      await advanceMissionGraph(job.missionId!); return {missionId:job.missionId,advanced:true};
    }
    case "discovery": {
      if(!job.missionId) throw new Error("Discovery job requires missionId");
      const db=await readDB(); const mission=db.missions.find(m=>m.id===job.missionId); if(!mission) throw new Error("Mission not found");
      return executeTool(job,"opportunity.discover",{missionId:job.missionId},async()=>{const location=process.env.NORTHSTAR_DISCOVERY_LOCATION||"Austin, Texas"; const opportunities=await discoverOpportunities({location,limit:10}); await updateDB(d=>d.opportunities.unshift(...opportunities.filter(o=>!d.opportunities.some(x=>x.sourceId===o.sourceId)))); return {count:opportunities.length};});
    }
    case "build": {
      if(!job.opportunityId) throw new Error("Build job requires opportunityId");
      const db=await readDB(); const opportunity=db.opportunities.find(o=>o.id===job.opportunityId);
      if(!opportunity) throw new Error("Opportunity not found");
      const asset=await executeTool(job,"website.generate",{opportunityId:opportunity.id},async()=>({asset:await generateWebsite(opportunity)}));
      return asset;
    }
    case "outreach": {
      if(!job.opportunityId) throw new Error("Outreach job requires opportunityId");
      const db=await readDB(); const opportunity=db.opportunities.find(o=>o.id===job.opportunityId);
      if(!opportunity) throw new Error("Opportunity not found");
      const asset=await executeTool(job,"outreach.draft",{opportunityId:opportunity.id},async()=>({asset:await draftOutreach(opportunity)}));
      return asset;
    }
    case "follow_up": { const { runDueFollowUps } = await import("./revenueExecution"); return executeTool(job,"follow_up.run",{missionId:job.missionId||null},async()=>runDueFollowUps(20) as Promise<Record<string,unknown>>); }
    case "measurement": {
      const db=await readDB();
      return await executeTool(job,"revenue.measure",{opportunityId:job.opportunityId||null},async()=>({
        opportunities:db.opportunities.length, leads:db.leads.length, deals:db.deals.length,
        wonRevenue:db.revenue.filter(r=>r.type==="won").reduce((s,r)=>s+r.amount,0)
      }));
    }
    default:
      throw new Error(`Worker does not support job kind: ${job.kind}`);
  }
}

export async function runWorker(limit=5) {
  const jobs=await claimJobs(Math.min(Math.max(limit,1),20));
  const results=[];
  for(const job of jobs) {
    try {
      await markNode(job,"running");
      const result=await executeJob(job);
      await completeJob(job.id,result);
      const current=await readDB();
      await resolveDecisionForJob(job,"succeeded",current.revenue.filter(r=>r.type==="won").reduce((s,r)=>s+r.amount,0));
      if(job.payload.strategyExperimentId && job.payload.strategyVariantId) await recordStrategyObservation({experimentId:String(job.payload.strategyExperimentId),variantId:String(job.payload.strategyVariantId),opportunityId:job.opportunityId,leadId:job.leadId,outcome:"pending",revenue:0});
      await markNode(job,"succeeded");
      if(job.missionId) await advanceMissionGraph(job.missionId);
      await audit("external_action.executed","system","job",job.id,{kind:job.kind,attempt:job.attempts});
      if(job.missionId) await replanMission(job.missionId, "worker_cycle");
      results.push({jobId:job.id,status:"succeeded",result});
    } catch(error) {
      const message=error instanceof Error?error.message:"Worker execution failed";
      await markNode(job,"failed");
      const failed=await (await import("./controlPlane")).failJob(job.id,message);
      if(failed.status==="failed") await resolveDecisionForJob(job,"failed");
      await audit("external_action.executed","system","job",job.id,{kind:job.kind,attempt:job.attempts,error:message,status:failed.status});
      if(job.missionId) await replanMission(job.missionId, "job_failure");
      results.push({jobId:job.id,status:failed.status,error:message});
    }
  }
  return {claimed:jobs.length,results};
}
