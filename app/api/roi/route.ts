import { NextResponse } from "next/server";
import { getROI } from "../../../lib/revenueExecution";
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get("opportunityId");
 if(!id)return NextResponse.json({error:"opportunityId is required"},{status:400});
 return NextResponse.json(await getROI(id));
}
