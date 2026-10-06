import { NextResponse } from "next/server";
import { approveJob, claimJobs, completeJob, enqueueJob, failJob, getControlPlane, recoverStaleJobs } from "../../../lib/controlPlane";

export async function GET(){ return NextResponse.json(await getControlPlane()); }

export async function POST(request:Request){
  const body=await request.json().catch(()=>({}));
  try{
    switch(body.action){
      case "enqueue":
        return NextResponse.json(await enqueueJob({
          kind:body.kind||"mission", missionId:body.missionId, opportunityId:body.opportunityId, leadId:body.leadId,
          payload:body.payload||{}, idempotencyKey:String(body.idempotencyKey||""), maxAttempts:Math.min(10,Math.max(1,Number(body.maxAttempts||3))),
          runAfter:body.runAfter||new Date().toISOString()
        }),{status:201});
      case "claim": return NextResponse.json({jobs:await claimJobs(Number(body.limit||5))});
      case "complete": return NextResponse.json(await completeJob(String(body.jobId),body.result||{}));
      case "fail": return NextResponse.json(await failJob(String(body.jobId),String(body.error||"Unknown execution error")));
      case "approve": return NextResponse.json(await approveJob(String(body.jobId)));
      case "recover": return NextResponse.json(await recoverStaleJobs(Number(body.timeoutMinutes||15)));
      default: return NextResponse.json({error:"Unknown control-plane action"},{status:400});
    }
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Control-plane operation failed"},{status:400});}
}
