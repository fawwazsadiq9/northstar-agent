import { readDB, updateDB } from "./store";
import { rankOpportunities, type EconomicModel } from "./economicOptimizer";
import { estimateEconomicCausality } from "./economicCausality";

export interface PortfolioAllocation {
  opportunityId:string; businessName:string; expectedValue:number; expectedCashVelocity:number;
  spend:number; allocation:"exploit"|"explore"; marginalROI:number; economicScore:number; rationale:string[];
}
export interface EconomicPortfolioPlan {
  budget:number; allocated:number; remaining:number; explorationBudget:number; explorationAllocated:number;
  allocations:PortfolioAllocation[]; rejected:EconomicModel[]; marginalROI:number; expectedCashGenerated:number;
  expectedRegret:number; generatedAt:string;
}

function num(name:string,fallback:number){const n=Number(process.env[name]);return Number.isFinite(n)&&n>=0?n:fallback;}

export async function optimizeEconomicPortfolio(limit=25):Promise<EconomicPortfolioPlan>{
  const portfolio=await rankOpportunities(Math.max(limit,50));
  const causal=await estimateEconomicCausality();
  const budget=portfolio.budget, explorationBudget=budget*num("NORTHSTAR_EXPLORATION_BUDGET_RATE",.2);
  let allocated=0,explorationAllocated=0,expectedCashGenerated=0,expectedRegret=0;
  const allocations:PortfolioAllocation[]=[];
  const usedContexts=new Map<string,number>();
  const ranked=[...portfolio.ranked].sort((a,b)=>b.expectedCashVelocity-a.expectedCashVelocity);
  const causalByKey=new Map(causal.map(x=>[x.key,x]));
  const rejected:EconomicModel[]=[];
  for(const m of ranked){
    const spend=m.acquisitionCost+m.executionCost;
    if(spend<=0||allocated+spend>budget)continue;
    const opportunity=(await readDB()).opportunities.find(o=>o.id===m.opportunityId);
    if(!opportunity)continue;
    const contextKey=[opportunity.category,opportunity.location,opportunity.websiteVerified===false?"website_gap":"revenue_opportunity","opportunity","outreach"].map(x=>(x||"unknown").toLowerCase()).join("|");
    const evidence=causalByKey.get(contextKey);
    const explore=!evidence||evidence.confidence<.5||!evidence.credible;
    const marginalROI=m.expectedValue/Math.max(.01,spend);
    const contextUse=usedContexts.get(contextKey)||0;
    if(contextUse>=num("NORTHSTAR_CONTEXT_CAPACITY",3)&&marginalROI<1)continue;
    if(explore&&explorationAllocated+spend>explorationBudget)continue;
    allocations.push({opportunityId:m.opportunityId,businessName:m.businessName,expectedValue:m.expectedValue,expectedCashVelocity:m.expectedCashVelocity,spend,allocation:explore?"explore":"exploit",marginalROI,economicScore:m.economicScore,rationale:[explore?"Evidence is insufficient, so this allocation buys information as well as expected value.":"Evidence supports exploiting the learned economic pattern.","Selection maximizes expected value per unit of scarce execution budget.","Repeated allocation to the same context is capped to reduce cannibalization."]});
    allocated+=spend;expectedCashGenerated+=Math.max(0,m.expectedRevenue);expectedRegret+=Math.max(0,m.expectedValue)*(explore?.25:.1);usedContexts.set(contextKey,contextUse+1);if(explore)explorationAllocated+=spend;
  }
  const chosen=new Set(allocations.map(x=>x.opportunityId));
  for(const m of ranked)if(!chosen.has(m.opportunityId))rejected.push(m);
  const marginalROI=allocations.length?allocations.reduce((s,x)=>s+x.marginalROI,0)/allocations.length:0;
  await updateDB(state=>{const d=state as Awaited<ReturnType<typeof readDB>> & {economicPortfolio?:EconomicPortfolioPlan};d.economicPortfolio={budget,allocated,remaining:Math.max(0,budget-allocated),explorationBudget,explorationAllocated,allocations,rejected,marginalROI,expectedCashGenerated,expectedRegret,generatedAt:new Date().toISOString()};return d;});
  return {budget,allocated,remaining:Math.max(0,budget-allocated),explorationBudget,explorationAllocated,allocations,rejected,marginalROI,expectedCashGenerated,expectedRegret,generatedAt:new Date().toISOString()};
}
export async function getEconomicPortfolio(){const db=await readDB() as Awaited<ReturnType<typeof readDB>> & {economicPortfolio?:EconomicPortfolioPlan};return db.economicPortfolio||optimizeEconomicPortfolio();}