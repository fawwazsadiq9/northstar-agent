import { NextResponse } from "next/server";
import { createLeadResponse, approveLeadResponse, sendLeadResponse, createAppointment, createDeal, closeDeal } from "../../../lib/revenueExecution";
export async function POST(request:Request){
 const b=await request.json().catch(()=>({})); const action=String(b.action||"");
 try{
  if(action==="respond") return NextResponse.json(await createLeadResponse(String(b.leadId)));\n  if(action==="approve_response") return NextResponse.json(await approveLeadResponse(String(b.responseId)));\n  if(action==="send_response") return NextResponse.json(await sendLeadResponse(String(b.responseId)));
  if(action==="appointment") return NextResponse.json(await createAppointment({leadId:String(b.leadId),startsAt:String(b.startsAt),endsAt:b.endsAt?String(b.endsAt):undefined,notes:b.notes?String(b.notes):undefined}),{status:201});
  if(action==="deal") return NextResponse.json(await createDeal({leadId:b.leadId?String(b.leadId):undefined,opportunityId:String(b.opportunityId),value:Number(b.value),currency:b.currency?String(b.currency):"USD"}),{status:201});
  if(action==="close_deal") return NextResponse.json(await closeDeal(String(b.dealId),b.status==="won"?"won":"lost"));
  return NextResponse.json({error:"Unsupported execution action"},{status:400});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Execution failed"},{status:400});}
}
