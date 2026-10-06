import { generateText } from "./ai";
import { id } from "./id";
import { updateDB } from "./store";
import type { Appointment, Attribution, Deal, Execution, LeadResponse } from "./types";

export async function createLeadResponse(leadId:string) {
  const db = await (await import("./store")).readDB();
  const lead = db.leads.find(x=>x.id===leadId);
  if (!lead) throw new Error("Lead not found");
  const opportunity = db.opportunities.find(x=>x.id===lead.opportunityId);
  if (!opportunity) throw new Error("Opportunity not found");
  let content = "";
  try {
    content = await generateText({
      system:"You are Northstar's lead-response agent. Write a concise, helpful first response. Never invent pricing, availability, guarantees, credentials, or facts. Ask one useful qualification question. This is a draft only and must not be sent automatically.",
      prompt:`Business: ${opportunity.businessName}
Category: ${opportunity.category}
Lead name: ${lead.name}
Lead message: ${lead.message || "No message supplied"}
Write the first response to this lead.`
    });
  } catch {
    content = `Hi ${lead.name}, thanks for reaching out to ${opportunity.businessName}. We'd be happy to learn more about what you need. Could you share a little more about what you're looking for and your preferred timing?`;
  }
  const response:LeadResponse={id:id("response"),leadId,content,channel:"email",status:"draft",kind:"initial",createdAt:new Date().toISOString()};
  const execution:Execution={id:id("exec"),opportunityId:opportunity.id,leadId,status:"completed",stage:"ai_response",nextAction:"Review and approve response",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  await updateDB(db=>{db.leadResponses.unshift(response);db.executions.unshift(execution);const l=db.leads.find(x=>x.id===leadId);if(l)l.status="replied";});
  return response;
}

export async function createAppointment(input:{leadId:string;startsAt:string;endsAt?:string;notes?:string}) {
  const db=await (await import("./store")).readDB();
  const lead=db.leads.find(x=>x.id===input.leadId);
  if(!lead) throw new Error("Lead not found");
  const appointment:Appointment={id:id("appt"),leadId:lead.id,opportunityId:lead.opportunityId,startsAt:input.startsAt,endsAt:input.endsAt,status:"scheduled",notes:input.notes,createdAt:new Date().toISOString()};
  await updateDB(db=>{db.appointments.unshift(appointment);const l=db.leads.find(x=>x.id===lead.id);if(l)l.status="meeting";});
  return appointment;
}

export async function createDeal(input:{leadId?:string;opportunityId:string;value:number;currency?:string}) {
  if (!Number.isFinite(input.value)||input.value<=0) throw new Error("Deal value must be positive");
  const deal:Deal={id:id("deal"),opportunityId:input.opportunityId,leadId:input.leadId,value:input.value,currency:input.currency||"USD",status:"open",createdAt:new Date().toISOString()};
  await updateDB(db=>db.deals.unshift(deal));
  return deal;
}

export async function closeDeal(dealId:string,status:"won"|"lost") {
  return updateDB(db=>{
    const deal=db.deals.find(x=>x.id===dealId); if(!deal) throw new Error("Deal not found");
    deal.status=status; deal.closedAt=new Date().toISOString();
    if(status==="won"){
      const lead=deal.leadId?db.leads.find(x=>x.id===deal.leadId):undefined;if(lead)lead.status="won";
      const opportunity=db.opportunities.find(x=>x.id===deal.opportunityId);if(opportunity)opportunity.status="won";
      db.revenue.unshift({id:id("rev"),opportunityId:deal.opportunityId,leadId:deal.leadId,dealId:deal.id,type:"won",amount:deal.value,currency:deal.currency,note:"Attributed closed-won revenue",createdAt:new Date().toISOString()});
      const attribution:Attribution={id:id("attr"),dealId:deal.id,leadId:deal.leadId||"",opportunityId:deal.opportunityId,revenueAmount:deal.value,currency:deal.currency,source:"northstar_execution",confidence:deal.leadId?0.95:0.7,createdAt:new Date().toISOString()};
      db.attributions.unshift(attribution);
    }
    return deal;
  });
}

export async function getROI(opportunityId:string){
  const db=await (await import("./store")).readDB();
  const revenue=db.revenue.filter(x=>x.opportunityId===opportunityId&&(x.type==="won"||x.type==="payment")).reduce((n,x)=>n+x.amount,0);
  const pipeline=db.revenue.filter(x=>x.opportunityId===opportunityId&&x.type==="pipeline").reduce((n,x)=>n+x.amount,0);
  const leads=db.leads.filter(x=>x.opportunityId===opportunityId).length;
  const meetings=db.appointments.filter(x=>x.opportunityId===opportunityId&&x.status==="scheduled").length;
  const deals=db.deals.filter(x=>x.opportunityId===opportunityId);
  return {opportunityId,revenue,pipeline,leads,meetings,deals:deals.length,wonDeals:deals.filter(x=>x.status==="won").length,roiMultiple:0,note:"ROI becomes monetary once Northstar operating cost is recorded."};
}


export async function approveLeadResponse(responseId:string) {
  return updateDB(db => {
    const response = db.leadResponses.find(x => x.id === responseId);
    if (!response) throw new Error("Lead response not found");
    if (response.status !== "draft") throw new Error("Only draft responses can be approved");
    response.status = "approved";
    return response;
  });
}

export async function sendLeadResponse(responseId:string) {
  const db = await (await import("./store")).readDB();
  const response = db.leadResponses.find(x => x.id === responseId);
  if (!response) throw new Error("Lead response not found");
  if (response.status !== "approved") throw new Error("Response must be approved before sending");
  const lead = db.leads.find(x => x.id === response.leadId);
  if (!lead) throw new Error("Lead not found");
  if (!lead.email) throw new Error("Lead has no email address");
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) throw new Error("RESEND_API_KEY and RESEND_FROM are required");
  const opportunity = db.opportunities.find(x => x.id === lead.opportunityId);
  const subject = response.kind === "follow_up"
    ? `Following up — ${opportunity?.businessName || "your inquiry"}`
    : `Re: ${opportunity?.businessName || "your inquiry"}`;
  const res = await fetch("https://api.resend.com/emails", {
    method:"POST",
    headers:{"content-type":"application/json",authorization:`Bearer ${apiKey}`},
    body:JSON.stringify({from,to:[lead.email],subject,text:response.content})
  });
  if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
  const now = new Date().toISOString();
  const sent = await updateDB(db => {
    const found = db.leadResponses.find(x => x.id === responseId);
    const l = db.leads.find(x => x.id === response?.leadId);
    if (!found || !l) throw new Error("Lead response no longer exists");
    found.status = "sent";
    l.lastContactedAt = now;
    l.nextFollowUpAt = new Date(Date.now() + 48*60*60*1000).toISOString();
    return found;
  });
  return sent;
}

export async function runDueFollowUps(limit = 20) {
  const now = Date.now();
  const db = await (await import("./store")).readDB();
  const due = db.leads
    .filter(l => l.nextFollowUpAt && Date.parse(l.nextFollowUpAt) <= now && !["won","lost"].includes(l.status) && !!l.email)
    .slice(0, Math.max(1, Math.min(limit, 50)));
  const results:{leadId:string;status:string;responseId?:string;reason?:string}[] = [];
  for (const lead of due) {
    const latest = db.leadResponses
      .filter(r => r.leadId === lead.id)
      .sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
    if (latest && latest.status !== "sent") {
      results.push({leadId:lead.id,status:"skipped",reason:"Latest response is not sent"});
      continue;
    }
    const opportunity = db.opportunities.find(o => o.id === lead.opportunityId);
    if (!opportunity) {
      results.push({leadId:lead.id,status:"skipped",reason:"Opportunity not found"});
      continue;
    }
    let content = "";
    try {
      content = await generateText({
        system:"You are Northstar's follow-up agent. Write a concise, respectful follow-up email. Never invent pricing, availability, guarantees, credentials, or facts. Ask for one simple next step. Do not use pressure, deception, or false urgency.",
        prompt:`Business: ${opportunity.businessName}
Lead: ${lead.name}
Previous lead message: ${lead.message || "No message supplied"}
Write a short follow-up after an earlier response received no recorded conversion yet.`
      });
    } catch {
      content = `Hi ${lead.name}, just following up on your request with ${opportunity.businessName}. If you'd still like help, what would be the best next step for you?`;
    }
    const response:LeadResponse = {id:id("response"),leadId:lead.id,content,channel:"email",status:"draft",kind:"follow_up",createdAt:new Date().toISOString()};
    await updateDB(db => {
      db.leadResponses.unshift(response);
      const l = db.leads.find(x => x.id === lead.id);
      if (l) l.nextFollowUpAt = undefined;
      db.executions.unshift({id:id("exec"),opportunityId:lead.opportunityId,leadId:lead.id,status:"completed",stage:"follow_up",nextAction:"Review and approve follow-up",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    });
    results.push({leadId:lead.id,status:"drafted",responseId:response.id});
  }
  return {processed:results.length,results};
}
