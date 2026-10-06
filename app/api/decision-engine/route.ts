import { NextResponse } from "next/server";
import { decideNextAction, executeDecision } from "../../../lib/decisionEngine";

export async function GET(request:Request){
  const missionId=new URL(request.url).searchParams.get("missionId");
  if(!missionId)return NextResponse.json({error:"missionId is required"},{status:400});
  try{return NextResponse.json(await decideNextAction(missionId));}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Decision error"},{status:400});}
}

export async function POST(request:Request){
  const b=await request.json().catch(()=>({})); const missionId=String(b.missionId||"");
  if(!missionId)return NextResponse.json({error:"missionId is required"},{status:400});
  try{return NextResponse.json(await executeDecision(missionId));}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Decision execution failed"},{status:400});}
}
