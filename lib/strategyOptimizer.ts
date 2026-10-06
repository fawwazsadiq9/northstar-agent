import { assignStrategy, ensureExperiment, type StrategyContext, type StrategyVariant, strategyPerformance } from "./strategy";
import { readDB } from "./store";

export interface StrategySelection {
  context: StrategyContext;
  experimentId: string;
  variant: StrategyVariant;
  exploration: boolean;
  confidence: number;
  score: number;
  rationale: string;
}

function channelVariants(action: string) {
  if (action === "build") return "website" as const;
  if (action === "outreach") return "outreach" as const;
  if (action === "follow_up") return "follow_up" as const;
  return "offer" as const;
}

function stats(rows: Awaited<ReturnType<typeof strategyPerformance>>, experimentId: string) {
  return rows.filter(x => x.variant.context && x.variant.id && x.variant);
}

export async function selectContextualStrategy(missionId: string, action: string, opportunityId?: string, leadId?: string): Promise<StrategySelection | null> {
  const db = await readDB();
  const opportunity = opportunityId ? db.opportunities.find(x => x.id === opportunityId) : undefined;
  const lead = leadId ? db.leads.find(x => x.id === leadId) : undefined;
  const context: StrategyContext = {
    industry: opportunity?.category || "unknown",
    geography: opportunity?.location || "unknown",
    opportunityType: opportunity?.websiteVerified === false ? "website_gap" : "revenue_opportunity",
    leadStage: lead?.status || (action === "outreach" ? "new" : "opportunity"),
    channel: channelVariants(action),
  };
  const experiment = await ensureExperiment(missionId, context);
  const performance = (await strategyPerformance()).filter(x => experiment.variants.includes(x.variant.id));
  const total = performance.reduce((sum, x) => sum + x.resolved, 0);
  const prior = 1;
  const scored = performance.map(x => {
    const wins = x.winRate * x.resolved;
    const mean = (wins + prior) / (x.resolved + 2 * prior);
    const exploration = Math.sqrt((2 * Math.log(Math.max(2, total + 1))) / Math.max(1, x.resolved));
    return { x, score: mean + exploration };
  }).sort((a, b) => b.score - a.score);
  const chosen = scored[0];
  if (!chosen) return null;
  const minResolved = Math.min(...performance.map(x => x.resolved));
  const variant = chosen.x.variant;
  const confidence = Math.min(1, chosen.x.resolved / 20);
  const exploration = minResolved < 5 || chosen.score > Math.max(...scored.slice(1).map(x => x.score), 0) + 0.08;
  return {
    context,
    experimentId: experiment.id,
    variant,
    exploration,
    confidence,
    score: chosen.score,
    rationale: exploration
      ? `Exploring ${variant.name} because contextual evidence is still sparse or its upper-confidence score leads the field.`
      : `Exploiting ${variant.name} because it has the strongest contextual outcome estimate.`,
  };
}

export async function assignContextualStrategy(missionId: string, action: string, opportunityId?: string, leadId?: string) {
  const selected = await selectContextualStrategy(missionId, action, opportunityId, leadId);
  if (!selected) return null;
  return { ...selected, variant: selected.variant || await assignStrategy(missionId, selected.context) };
}
