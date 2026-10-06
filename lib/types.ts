export type MissionStatus = "queued" | "running" | "completed" | "failed";
export type OpportunityStatus = "new" | "qualified" | "contacted" | "won" | "lost";
export type LeadStatus = "new" | "qualified" | "replied" | "meeting" | "won" | "lost";
export type AssetStatus = "draft" | "ready" | "published";
export type ExecutionStatus = "pending" | "running" | "completed" | "failed";
export type AppointmentStatus = "requested" | "scheduled" | "completed" | "cancelled" | "no_show";
export type DealStatus = "open" | "won" | "lost";

export interface Mission { id:string; objective:string; status:MissionStatus; progress:number; currentStage:string; createdAt:string; updatedAt:string; }
export interface RevenueAudit { opportunityId:string; businessName:string; score:number; confidence:number; modeledMonthlyOpportunities:{low:number;high:number}; modeledAnnualRevenue:{low:number;high:number}; assumedDealValue:number; gaps:string[]; actions:string[]; disclaimer:string; }
export interface Opportunity { id:string; businessName:string; website?:string; deployedWebsiteUrl?:string; category:string; location:string; score:number; signals:string[]; status:OpportunityStatus; source?:string; sourceId?:string; phone?:string; contactEmail?:string; createdAt:string; }
export interface Lead { id:string; opportunityId:string; name:string; email?:string; phone?:string; message?:string; status:LeadStatus; source:string; lastContactedAt?:string; nextFollowUpAt?:string; createdAt:string; }
export interface Asset { id:string; opportunityId:string; type:"website"|"offer"|"email"|"lead_response"; title:string; content:string; status:AssetStatus; deploymentUrl?:string; createdAt:string; }
export interface RevenueEvent { id:string; opportunityId?:string; leadId?:string; dealId?:string; type:"pipeline"|"won"|"lost"|"payment"; amount:number; currency:string; note:string; createdAt:string; }
export interface LeadResponse { id:string; leadId:string; content:string; channel:string; status:"draft"|"approved"|"sent"; createdAt:string; }
export interface Appointment { id:string; leadId:string; opportunityId:string; startsAt:string; endsAt?:string; status:AppointmentStatus; notes?:string; createdAt:string; }
export interface Deal { id:string; opportunityId:string; leadId?:string; value:number; currency:string; status:DealStatus; closedAt?:string; createdAt:string; }
export interface Attribution { id:string; dealId:string; leadId:string; opportunityId:string; revenueAmount:number; currency:string; source:string; confidence:number; createdAt:string; }
export interface Execution { id:string; opportunityId:string; leadId?:string; status:ExecutionStatus; stage:string; nextAction:string; error?:string; createdAt:string; updatedAt:string; }
export interface NorthstarDB {
  missions:Mission[]; opportunities:Opportunity[]; leads:Lead[]; assets:Asset[]; revenue:RevenueEvent[];
  leadResponses:LeadResponse[]; appointments:Appointment[]; deals:Deal[]; attributions:Attribution[]; executions:Execution[];
  audit?: unknown[];
}
