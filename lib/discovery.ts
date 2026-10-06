import type { Opportunity } from "./types";
import { id } from "./id";

const seeds = [
  ["Bright Dental Studio", "Dental", "Austin, TX", 91, ["No lead-response system", "Weak conversion path", "High-intent service"]],
  ["Atlas Home Roofing", "Roofing", "Phoenix, AZ", 88, ["Slow inquiry path", "High-ticket service", "Follow-up opportunity"]],
  ["Northline Med Spa", "Med Spa", "Miami, FL", 86, ["No clear offer", "Mobile UX gap", "High-value leads"]],
  ["Summit HVAC", "HVAC", "Denver, CO", 83, ["No after-hours response", "Local demand", "Follow-up gap"]]
] as const;

export function discoverOpportunities(limit = 10): Opportunity[] {
  return seeds.slice(0, limit).map(([businessName, category, location, score, signals]) => ({
    id: id("opp"), businessName, category, location, score, signals: [...signals],
    status: "new", createdAt: new Date().toISOString()
  }));
}