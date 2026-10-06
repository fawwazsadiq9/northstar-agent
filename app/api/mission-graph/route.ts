import { NextResponse } from "next/server";
import { approveMissionNode, advanceMissionGraph, createMissionGraph, getMissionGraph } from "../../../lib/missionGraph";

export async function GET(request:Request){
  const missionId=new URL(request.url).searchParams.get("missionId");
  if(!missionId)return NextResponse.json({error:"missionId is required"},{status:400});
  return NextResponse.json(await getMissionGraph(missionId));
}
export async function POST(request:Request){
  const b=await request.json().catch(()=>({})); const missionId=String(b.missionId||"");
  if(!missionId)return NextResponse.json({error:"missionId is required"},{status:400});
  try{
    if(b.action==="create") return NextResponse.json(await createMissionGraph(missionId),{status:201});
    if(b.action==="advance") return NextResponse.json(await advanceMissionGraph(missionId));
    if(b.action==="approve") return NextResponse.json(await approveMissionNode(String(b.nodeId)));
    return NextResponse.json({error:"Unknown action"},{status:400});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Mission graph error"},{status:400});}
}
