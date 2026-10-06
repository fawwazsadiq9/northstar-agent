import { NextResponse } from "next/server";
import { recoverStaleJobs } from "../../../../lib/controlPlane";

export async function POST(request:Request){
  const secret=process.env.NORTHSTAR_CRON_SECRET;
  if(secret && request.headers.get("authorization")!==`Bearer ${secret}`) return NextResponse.json({error:"Unauthorized"},{status:401});
  return NextResponse.json(await recoverStaleJobs());
}
export async function GET(request:Request){ return POST(request); }
