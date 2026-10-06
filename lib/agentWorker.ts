import { audit } from "./audit";
import { completeJob, failJob, claimJobs, recordToolExecution, finishToolExecution, type AgentJob } from "./controlPlane";
import { runMission } from "./mission";
import { generateOffer, generateWebsite, draftOutreach } from "./operator";
import { readDB } from "./store";

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

async function executeJob(job:AgentJob):Promise<Record<string,unknown>> {
  switch(job.kind) {
    case "mission": {
      if(!job.missionId) throw new Error("Mission job requires missionId");
      const mission=await executeTool(job,"mission.run",{missionId:job.missionId},async()=>({mission:await runMission(job.missionId!)}));
      return mission;
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
      const result=await executeJob(job);
      await completeJob(job.id,result);
      await audit("external_action.executed","system","job",job.id,{kind:job.kind,attempt:job.attempts});
      results.push({jobId:job.id,status:"succeeded",result});
    } catch(error) {
      const message=error instanceof Error?error.message:"Worker execution failed";
      const failed=await (await import("./controlPlane")).failJob(job.id,message);
      await audit("external_action.executed","system","job",job.id,{kind:job.kind,attempt:job.attempts,error:message,status:failed.status});
      results.push({jobId:job.id,status:failed.status,error:message});
    }
  }
  return {claimed:jobs.length,results};
}
