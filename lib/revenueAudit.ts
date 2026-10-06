import type { Opportunity } from "./types";

export interface RevenueAudit {
  opportunityId: string;
  businessName: string;
  score: number;
  confidence: number;
  modeledMonthlyOpportunities: { low: number; high: number };
  modeledAnnualRevenue: { low: number; high: number };
  assumedDealValue: number;
  gaps: string[];
  actions: string[];
  disclaimer: string;
}

const dealValues: Record<string, number> = {
  dental: 1200,
  hvac: 2500,
  roofing: 8000,
  salon: 500,
  auto: 1800,
  restaurant: 120,
  default: 2000
};

function hasSignal(o: Opportunity, pattern: RegExp) {
  return o.signals.some(s => pattern.test(s));
}

export function buildRevenueAudit(o: Opportunity): RevenueAudit {
  const gaps: string[] = [];
  const actions: string[] = [];
  let low = 2;
  let high = 5;

  if (o.websiteVerified === false && hasSignal(o, /could not be reached/i)) {
    gaps.push("Listed website is currently unreachable");
    actions.push("Offer a conversion-focused replacement or recovery plan with a clear call-to-action");
    low += 2; high += 4;
  }
  if (hasSignal(o, /phone/i)) {
    gaps.push("Public phone signal available for direct lead capture");
    actions.push("Add instant lead-response and missed-call recovery");
    low += 1; high += 2;
  }
  if (hasSignal(o, /hours|opening/i)) {
    actions.push("Use operating-hour context to improve lead routing and follow-up");
    high += 1;
  }
  if (hasSignal(o, /email/i)) {
    gaps.push("Public email signal available for structured outreach");
    actions.push("Prepare personalized outbound and follow-up sequences");
    low += 1; high += 2;
  }

  if (!gaps.length && !o.website) {\n    actions.push("Verify whether the business has an active website before making a web-presence claim");\n  }\n\n  if (!gaps.length) {
    gaps.push("Insufficient public evidence for a specific revenue leak");
    actions.push("Run a deeper website, response-time, and funnel audit before making claims");
  }

  const assumedDealValue = dealValues[o.category.toLowerCase()] ?? dealValues.default;
  const confidence = Math.min(90, Math.max(35, Math.round(45 + o.score * 0.35 + (gaps.length > 1 ? 8 : 0))));
  const annualLow = low * assumedDealValue * 12;
  const annualHigh = high * assumedDealValue * 12;

  return {
    opportunityId: o.id,
    businessName: o.businessName,
    score: o.score,
    confidence,
    modeledMonthlyOpportunities: { low, high },
    modeledAnnualRevenue: { low: annualLow, high: annualHigh },
    assumedDealValue,
    gaps,
    actions,
    disclaimer: "Scenario model, not verified business revenue. Assumptions must be validated with the business before pricing or promising outcomes."
  };
}
