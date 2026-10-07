import { readDB, updateDB } from "./store";
import { reconcileStrategyOutcomes } from "./strategy";
import { rebuildEconomicPriors } from "./economicLearning";
import { estimateEconomicCausality, reconcileEconomicRegret } from "./economicCausality";
import { optimizeMultiPeriodCapital, type MultiPeriodPlan } from "./multiPeriodCapital";

export type ReplanTrigger =
  | "worker_cycle"
  | "revenue_outcome"
  | "job_failure"
  | "opportunity_arrival"
  | "manual";

export interface ReplanEvent {
  id:string;
  missionId:string;
  trigger:ReplanTrigger;
  releasedCapital:number;
  priorAllocated:number;
  newAllocated:number;
  expectedCashBefore:number;
  expectedCashAfter:number;
  expectedRegretBefore:number;
  expectedRegretAfter:number;
  explorationRate:number;
  allocationsChanged:boolean;
  createdAt:string;
}

type LoopDB = Awaited<ReturnType<typeof readDB>> & {
  multiPeriodPlans?: MultiPeriodPlan[];
  closedLoopEvents?:ReplanEvent[];
};

function eventId(){return "replan_"+crypto.randomUUID();}

function materiallyChanged(
  previous:MultiPeriodPlan|null,
  next:MultiPeriodPlan,
):boolean {
  if(!previous) return true;
  const a=previous.allocations.map(x=>x.opportunityId+"|"+x.period+"|"+(x.strategyVariantId||"")).sort().join(",");
  const b=next.allocations.map(x=>x.opportunityId+"|"+x.period+"|"+(x.strategyVariantId||"")).sort().join(",");
  return a!==b || Math.abs(previous.allocated-next.allocated)>0.01;
}

/**
 * Closed-loop economic controller:
 * observe outcomes -> reconcile evidence -> rebuild priors -> re-estimate
 * strategy economics/regret -> optimize the next rolling horizon.
 *
 * Planning values remain estimates; this loop does not claim causal certainty.
 */
export async function replanMission(
  missionId:string,
  trigger:ReplanTrigger="manual",
):Promise<{plan:MultiPeriodPlan;event:ReplanEvent}> {
  await reconcileStrategyOutcomes();
  await rebuildEconomicPriors();
  await estimateEconomicCausality();
  await reconcileEconomicRegret();

  const db=await readDB() as LoopDB;
  const previous=db.multiPeriodPlans?.find(p=>p.missionId===missionId)||null;

  const plan=await optimizeMultiPeriodCapital(missionId);

  const releasedCapital=Math.max(0,(previous?.allocated||0)-plan.allocated);
  const event:ReplanEvent={
    id:eventId(),
    missionId,
    trigger,
    releasedCapital,
    priorAllocated:previous?.allocated||0,
    newAllocated:plan.allocated,
    expectedCashBefore:previous?.expectedCumulativeCash||0,
    expectedCashAfter:plan.expectedCumulativeCash,
    expectedRegretBefore:previous?.expectedRegret||0,
    expectedRegretAfter:plan.expectedRegret,
    explorationRate:plan.budget>0?plan.explorationBudget/plan.budget:0,
    allocationsChanged:materiallyChanged(previous,plan),
    createdAt:new Date().toISOString(),
  };

  await updateDB(state=>{
    const d=state as LoopDB;
    d.closedLoopEvents??=[];
    d.closedLoopEvents=[event,...d.closedLoopEvents].slice(0,100);
    return d;
  });

  return {plan,event};
}

export async function getReplanState(missionId:string){
  const db=await readDB() as LoopDB;
  const plan=db.multiPeriodPlans?.find(p=>p.missionId===missionId)||null;
  const events=(db.closedLoopEvents||[]).filter(e=>e.missionId===missionId).slice(0,20);
  return {plan,events,lastReplan:events[0]||null};
}
