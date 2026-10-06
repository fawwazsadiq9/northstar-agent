import { id } from "./id";
import { readDB, updateDB } from "./store";
import type { Execution, NorthstarDB } from "./types";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "retrying" | "blocked";
export type JobKind = "mission" | "discovery" | "build" | "outreach" | "follow_up" | "deployment" | "measurement";

export interface AgentJob {
  id:string; kind:JobKind; status:JobStatus; missionId?:string; opportunityId?:string; leadId?:string;
  payload:Record<string,unknown>; idempotencyKey:string; attempts:number; maxAttempts:number;
  runAfter:string; lockedAt?:string; lastError?:string; result?:Record<string,unknown>; createdAt:string; updatedAt:string;
}

export interface ToolExecution {
  id:string; jobId:string; tool:string; status:"running"|"succeeded"|"failed";
  input:Record<string,unknown>; output?:Record<string,unknown>; error?:string; startedAt:string; finishedAt?:string;
}

type ControlDB = NorthstarDB & { jobs?:AgentJob[]; toolExecutions?:ToolExecution[] };

function normalizeControl(db:NorthstarDB):ControlDB {
  const d=db as ControlDB; d.jobs ??=[]; d.toolExecutions ??=[]; return d;
}

export async function enqueueJob(input:Omit<AgentJob,"id"|"status"|"attempts"|"createdAt"|"updatedAt">) {
  return updateDB(db => {
    const d=normalizeControl(db);
    const existing=d.jobs!.find(j=>j.idempotencyKey===input.idempotencyKey);
    if(existing) return existing;
    const now=new Date().toISOString();
    const job:AgentJob={...input,id:id("job"),status:"queued",attempts:0,createdAt:now,updatedAt:now};
    d.jobs!.unshift(job);
    return job;
  });
}

export async function claimJobs(limit=5) {
  return updateDB(db => {
    const d=normalizeControl(db); const now=Date.now(); const iso=new Date().toISOString();
    return d.jobs!.filter(j=>["queued","retrying"].includes(j.status)&&Date.parse(j.runAfter)<=now)
      .slice(0,limit).map(j=>{j.status="running";j.lockedAt=iso;j.attempts+=1;j.updatedAt=iso;return j;});
  });
}

export async function completeJob(jobId:string,result:Record<string,unknown>={}) {
  return updateDB(db=>{const d=normalizeControl(db);const j=d.jobs!.find(x=>x.id===jobId);if(!j)throw Error("Job not found");j.status="succeeded";j.result=result;j.lockedAt=undefined;j.updatedAt=new Date().toISOString();return j;});
}

export async function failJob(jobId:string,error:string) {
  return updateDB(db=>{
    const d=normalizeControl(db); const j=d.jobs!.find(x=>x.id===jobId); if(!j)throw Error("Job not found");
    const retry=j.attempts<j.maxAttempts;
    j.status=retry?"retrying":"failed"; j.lastError=error; j.lockedAt=undefined;
    j.runAfter=new Date(Date.now()+Math.min(60,2**j.attempts)*60_000).toISOString(); j.updatedAt=new Date().toISOString();
    return j;
  });
}

export async function recordToolExecution(input:Omit<ToolExecution,"id"|"startedAt">) {
  return updateDB(db=>{const d=normalizeControl(db);const item:ToolExecution={...input,id:id("tool"),startedAt:new Date().toISOString()};d.toolExecutions!.unshift(item);return item;});
}

export async function finishToolExecution(toolExecutionId:string,success:boolean,output?:Record<string,unknown>,error?:string) {
  return updateDB(db=>{const d=normalizeControl(db);const t=d.toolExecutions!.find(x=>x.id===toolExecutionId);if(!t)throw Error("Tool execution not found");t.status=success?"succeeded":"failed";t.output=output;t.error=error;t.finishedAt=new Date().toISOString();return t;});
}

export async function approveJob(jobId:string) {
  return updateDB(db=>{const d=normalizeControl(db);const j=d.jobs!.find(x=>x.id===jobId);if(!j)throw Error("Job not found");if(j.status!=="blocked")throw Error("Only blocked jobs require approval");j.status="queued";j.runAfter=new Date().toISOString();j.updatedAt=new Date().toISOString();return j;});
}

export async function recoverStaleJobs(timeoutMinutes=15) {
  return updateDB(db=>{const d=normalizeControl(db);const cutoff=Date.now()-timeoutMinutes*60_000;let recovered=0;for(const j of d.jobs!){if(j.status==="running"&&j.lockedAt&&Date.parse(j.lockedAt)<cutoff){j.status=j.attempts<j.maxAttempts?"retrying":"failed";j.lastError="Recovered stale execution";j.lockedAt=undefined;j.runAfter=new Date().toISOString();j.updatedAt=new Date().toISOString();recovered++;}}return {recovered};});
}

export async function getControlPlane() {
  const db=normalizeControl(await readDB());
  return {jobs:db.jobs!,toolExecutions:db.toolExecutions!,executions:db.executions};
}
