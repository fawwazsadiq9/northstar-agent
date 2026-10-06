import { NextResponse } from "next/server";
import { runWorker } from "../../../lib/agentWorker";

export async function POST(request:Request){
  const secret=process.env.NORTHSTAR_CRON_SECRET;
  if(secret && request.headers.get("authorization")!==`Bearer ${secret}`) return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json().catch(()=>({}));
  return NextResponse.json(await runWorker(Number(body.limit||5)));
}

export async function GET(request:Request){
  const secret=process.env.NORTHSTAR_CRON_SECRET;
  if(secret && request.headers.get("authorization")!==`Bearer ${secret}`) return NextResponse.json({error:"Unauthorized"},{status:401});
  return NextResponse.json(await runWorker(5));
}
