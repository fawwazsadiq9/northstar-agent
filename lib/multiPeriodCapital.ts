import { getDB, updateDB } from "./store";
import { scoreOpportunity } from "./economicOptimizer";
import { selectContextualStrategy } from "./strategyOptimizer";

export type PlanningPeriod = {
  index: number;
  startAt: string;
  endAt: string;
  budget: number;
  capacity: number;
};

export type HorizonCandidate = {
  opportunityId: string;
  businessName: string;
  period: number;
  strategyVariantId?: string;
  strategyName?: string;
  expectedValue: number;
  expectedCash: number;
  spend: number;
  capacityUnits: number;
  probabilityOfArrival: number;
  informationValue: number;
  exploration: boolean;
  regretRisk: number;
  timeToCashDays: number;
  score: number;
  rationale: string;
};

export type MultiPeriodPlan = {
  missionId: string;
  horizonPeriods: number;
  periods: PlanningPeriod[];
  budget: number;
  allocated: number;
  remaining: number;
  capacity: number;
  capacityUsed: number;
  expectedCumulativeCash: number;
  expectedInformationValue: number;
  expectedRegret: number;
  explorationBudget: number;
  explorationAllocated: number;
  allocations: HorizonCandidate[];
  rejected: Array<{ opportunityId: string; reason: string }>;
  generatedAt: string;
};

type OpportunityLike = {
  id: string;
  businessName: string;
  status?: string;
  category?: string;
  location?: string;
  score?: number;
  createdAt?: string;
  websiteVerified?: boolean;
};

const num = (v: unknown, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

function horizonPeriods(horizon: number, budget: number, capacity: number): PlanningPeriod[] {
  const safe = Math.max(1, Math.min(30, Math.floor(horizon)));
  const perBudget = budget / safe;
  const perCapacity = Math.max(1, Math.ceil(capacity / safe));
  const now = Date.now();
  return Array.from({ length: safe }, (_, index) => {
    const start = new Date(now + index * 86400000);
    const end = new Date(now + (index + 1) * 86400000);
    return {
      index,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      budget: perBudget,
      capacity: perCapacity,
    };
  });
}

function arrivalProbability(opportunity: OpportunityLike, period: number): number {
  const ageDays = opportunity.createdAt
    ? Math.max(0, (Date.now() - new Date(opportunity.createdAt).getTime()) / 86400000)
    : 0;
  const freshness = Math.max(0.25, 1 - ageDays / 30);
  const decay = Math.exp(-period / 8);
  return Math.min(1, Math.max(0.05, freshness * decay));
}

function cashByPeriod(expectedValue: number, timeToCashDays: number, period: number): number {
  const daysUntilPeriod = period;
  const arrival = Math.max(0.05, Math.exp(-daysUntilPeriod / 8));
  const cashDelay = Math.max(1, timeToCashDays);
  return Math.max(0, expectedValue * arrival * Math.exp(-cashDelay / 45));
}

function informationValue(
  expectedValue: number,
  confidence: number,
  exploration: boolean,
  period: number,
): number {
  if (!exploration) return expectedValue * 0.01 * Math.max(0.2, 1 - period / 20);
  return expectedValue * (0.04 + (1 - confidence) * 0.06) * Math.max(0.2, 1 - period / 20);
}

/**
 * Rolling-horizon capital planner.
 *
 * This is intentionally a planning model rather than a claim of causal certainty:
 * it prices future cash, information gained by exploration, opportunity arrival/decay,
 * and regret risk while respecting today's finite budget/capacity.
 */
export async function optimizeMultiPeriodCapital(
  missionId: string,
  options?: { horizon?: number; budget?: number; capacity?: number; explorationRate?: number },
): Promise<MultiPeriodPlan> {
  const db: any = await getDB();
  const horizon = Math.max(1, Math.min(30, options?.horizon ?? Number(process.env.NORTHSTAR_PLANNING_HORIZON_DAYS || 7)));
  const budget = Math.max(0, options?.budget ?? Number(process.env.NORTHSTAR_DAILY_EXECUTION_BUDGET_USD || 25) * horizon);
  const capacity = Math.max(1, options?.capacity ?? Number(process.env.NORTHSTAR_DAILY_EXECUTION_CAPACITY || 10) * horizon);
  const explorationRate = Math.min(0.8, Math.max(0, options?.explorationRate ?? Number(process.env.NORTHSTAR_EXPLORATION_BUDGET_RATE || 0.2)));
  const periods = horizonPeriods(horizon, budget, capacity);
  const explorationBudget = budget * explorationRate;

  const opportunities = (db.opportunities || []).filter((o: OpportunityLike) =>
    ["new", "qualified", "contacted"].includes(o.status || "new"),
  ) as OpportunityLike[];

  const candidates: HorizonCandidate[] = [];
  for (const opportunity of opportunities) {
    const economic: any = await scoreOpportunity(opportunity.id);
    const action = opportunity.status === "new" ? "build" : opportunity.status === "qualified" ? "outreach" : "follow_up";
    let strategy: any = null;
    try {
      strategy = await selectContextualStrategy(missionId, action, opportunity.id);
    } catch {
      strategy = null;
    }

    const confidence = num(economic?.winProbability, 0.25);
    const expectedValue = Math.max(0, num(economic?.expectedValue));
    const spend = Math.max(0.01, num(economic?.acquisitionCost) + num(economic?.executionCost));
    const timeToCashDays = Math.max(1, num(economic?.expectedDaysToCash, 14));
    const basePeriod = Math.min(horizon - 1, Math.max(0, Math.round(timeToCashDays / 2)));
    const arrival = arrivalProbability(opportunity, basePeriod);
    const uncertainty = 1 - confidence;

    for (const period of periods) {
      if (period.index < basePeriod) continue;
      const exploration = Boolean(strategy?.exploration) || uncertainty > 0.55;
      const expectedCash = cashByPeriod(expectedValue, timeToCashDays, period.index);
      const info = informationValue(expectedValue, confidence, exploration, period.index);
      const regretRisk = expectedValue * uncertainty * 0.08;
      const score = expectedCash + info - spend * 0.5 - regretRisk;
      candidates.push({
        opportunityId: opportunity.id,
        businessName: opportunity.businessName,
        period: period.index,
        strategyVariantId: strategy?.variant?.id,
        strategyName: strategy?.variant?.name,
        expectedValue,
        expectedCash,
        spend,
        capacityUnits: 1,
        probabilityOfArrival: arrivalProbability(opportunity, period.index),
        informationValue: info,
        exploration,
        regretRisk,
        timeToCashDays,
        score,
        rationale: exploration
          ? "Exploration is funded because uncertainty creates measurable information value."
          : "Exploitation is favored because learned economics support faster expected cash.",
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const allocations: HorizonCandidate[] = [];
  const rejected: Array<{ opportunityId: string; reason: string }> = [];
  const used = new Set<string>();
  let allocated = 0;
  let capacityUsed = 0;
  let explorationAllocated = 0;

  for (const candidate of candidates) {
    if (used.has(candidate.opportunityId)) continue;
    if (allocated + candidate.spend > budget) {
      rejected.push({ opportunityId: candidate.opportunityId, reason: "Budget exhausted for rolling horizon." });
      continue;
    }
    if (capacityUsed + candidate.capacityUnits > capacity) {
      rejected.push({ opportunityId: candidate.opportunityId, reason: "Execution capacity exhausted for rolling horizon." });
      continue;
    }
    if (candidate.exploration && explorationAllocated + candidate.spend > explorationBudget) continue;

    const period = periods[candidate.period];
    const periodAllocated = allocations.filter(a => a.period === candidate.period).reduce((sum, a) => sum + a.spend, 0);
    const periodCapacity = allocations.filter(a => a.period === candidate.period).reduce((sum, a) => sum + a.capacityUnits, 0);
    if (periodAllocated + candidate.spend > period.budget || periodCapacity + candidate.capacityUnits > period.capacity) continue;

    allocations.push(candidate);
    used.add(candidate.opportunityId);
    allocated += candidate.spend;
    capacityUsed += candidate.capacityUnits;
    if (candidate.exploration) explorationAllocated += candidate.spend;
  }

  const expectedCumulativeCash = allocations.reduce((sum, a) => sum + a.expectedCash, 0);
  const expectedInformationValue = allocations.reduce((sum, a) => sum + a.informationValue, 0);
  const expectedRegret = allocations.reduce((sum, a) => sum + a.regretRisk, 0);

  const plan: MultiPeriodPlan = {
    missionId,
    horizonPeriods: horizon,
    periods,
    budget,
    allocated,
    remaining: Math.max(0, budget - allocated),
    capacity,
    capacityUsed,
    expectedCumulativeCash,
    expectedInformationValue,
    expectedRegret,
    explorationBudget,
    explorationAllocated,
    allocations,
    rejected,
    generatedAt: new Date().toISOString(),
  };

  await updateDB((current: any) => {
    const plans = Array.isArray(current.multiPeriodPlans) ? current.multiPeriodPlans : [];
    current.multiPeriodPlans = [plan, ...plans.filter((p: MultiPeriodPlan) => p.missionId !== missionId)].slice(0, 20);
    return current;
  });

  return plan;
}

export async function getMultiPeriodCapitalPlan(missionId: string): Promise<MultiPeriodPlan | null> {
  const db: any = await getDB();
  return ((db.multiPeriodPlans || []) as MultiPeriodPlan[]).find(p => p.missionId === missionId) || null;
}
