import type { NorthstarDB, Opportunity } from "./types";

function csv(value: unknown) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function has(o: Opportunity, pattern: RegExp) {
  return o.signals.some(s => pattern.test(s));
}

export function buildOrangeDataset(db: NorthstarDB) {
  const header = [
    "opportunity_id","business_name","category","location","opportunity_score",
    "has_website","website_verified","has_contact_email","has_phone",
    "lead_count","replied_lead_count","meeting_count","deal_count","won_deal_count",
    "pipeline_value","won_revenue","converted"
  ];

  const rows = db.opportunities.map(o => {
    const leads = db.leads.filter(l => l.opportunityId === o.id);
    const meetings = db.appointments.filter(a => a.opportunityId === o.id && a.status !== "cancelled" && a.status !== "no_show");
    const deals = db.deals.filter(d => d.opportunityId === o.id);
    const wonDeals = deals.filter(d => d.status === "won");
    const pipelineValue = deals.filter(d => d.status === "open").reduce((n,d) => n + d.value, 0);
    const wonRevenue = db.attributions.filter(a => a.opportunityId === o.id).reduce((n,a) => n + a.revenueAmount, 0);
    const replied = leads.filter(l => ["replied","meeting","won"].includes(l.status)).length;
    const converted = wonDeals.length > 0 ? 1 : 0;

    return [
      o.id, o.businessName, o.category, o.location, o.score,
      o.website ? 1 : 0,
      o.websiteVerified === true ? 1 : o.websiteVerified === false ? 0 : "",
      o.contactEmail ? 1 : 0,
      o.phone ? 1 : 0,
      leads.length, replied, meetings.length, deals.length, wonDeals.length,
      pipelineValue, wonRevenue, converted
    ].map(csv).join(",");
  });

  return [header.join(","), ...rows].join("\n") + "\n";
}

export function orangeReadiness(db: NorthstarDB) {
  const opportunities = db.opportunities.length;
  const labeled = db.opportunities.filter(o => db.deals.some(d => d.opportunityId === o.id)).length;
  return {
    opportunities,
    labeledOpportunities: labeled,
    readyForPrediction: labeled >= 20,
    recommendation: labeled >= 20
      ? "Train and compare classification models in Orange using converted as the target."
      : "Collect more opportunity outcomes before trusting a predictive model. Orange can still explore rankings and clusters now."
  };
}
