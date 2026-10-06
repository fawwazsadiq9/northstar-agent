export type MissionStatus = "queued" | "running" | "completed" | "failed";
export type OpportunityStatus = "new" | "qualified" | "contacted" | "won" | "lost";
export type LeadStatus = "new" | "qualified" | "replied" | "meeting" | "won" | "lost";

export interface Mission {
  id: string; objective: string; status: MissionStatus; progress: number; currentStage: string; createdAt: string; updatedAt: string;
}
export interface RevenueAudit {\n  opportunityId: string;\n  businessName: string;\n  score: number;\n  confidence: number;\n  modeledMonthlyOpportunities: { low: number; high: number };\n  modeledAnnualRevenue: { low: number; high: number };\n  assumedDealValue: number;\n  gaps: string[];\n  actions: string[];\n  disclaimer: string;\n}\n\nexport interface Opportunity {
  id: string; businessName: string; website?: string; deployedWebsiteUrl?: string; category: string; location: string; score: number; signals: string[];
  status: OpportunityStatus; source?: string; sourceId?: string; phone?: string; createdAt: string;
}
export interface Lead {
  id: string; opportunityId: string; name: string; email?: string; phone?: string; status: LeadStatus; source: string;
  lastContactedAt?: string; nextFollowUpAt?: string; createdAt: string;
}
export interface Asset {
  id: string; opportunityId: string; type: "website" | "offer" | "email"; title: string; content: string;
  status: "draft" | "ready" | "published"; deploymentUrl?: string; createdAt: string;
}
export interface RevenueEvent {
  id: string; opportunityId?: string; type: "pipeline" | "won" | "lost" | "payment"; amount: number; currency: string; note: string; createdAt: string;
}
export interface NorthstarDB {
  missions: Mission[]; opportunities: Opportunity[]; leads: Lead[]; assets: Asset[]; revenue: RevenueEvent[];
}
