import { NextResponse } from "next/server";
import { getReplanState, replanMission, type ReplanTrigger } from "../../../lib/closedLoop";

export async function GET(request:Request){
  const missionId=new URL(request.url).searchParams.get("missionId");
  if(!missionId) return NextResponse.json({error:"missionId is required"},{status:400});
  return NextResponse.json(await getReplanState(missionId));
}

export async function POST(request:Request){
  const secret=process.env.NORTHSTAR_CRON_SECRET;
  if(secret && request.headers.get("authorization")!==`Bearer ${secret}`) {
    return NextResponse.json({error:"Unauthorized"},{status:401});
  }
  const body=await request.json().catch(()=>({}));
  const missionId=String(body.missionId||"");
  if(!missionId) return NextResponse.json({error:"missionId is required"},{status:400});
  const allowed:["worker_cycle","revenue_outcome","job_failure","opportunity_arrival","manual"]=["worker_cycle","revenue_outcome","job_failure","opportunity_arrival","manual"];
  const trigger=allowed.includes(body.trigger)?body.trigger as ReplanTrigger:"manual";
  try { return NextResponse.json(await replanMission(missionId,trigger)); }
  catch(error){ return NextResponse.json({error:error instanceof Error?error.message:"Replan failed"},{status:500}); }
}
