import { readDB, updateDB } from "./store";
import { scoreOpportunity } from "./economicOptimizer";
import { selectContextualStrategy } from "./strategyOptimizer";

export interface JointAllocation {
  opportunityId:string; businessName:string; strategyVariantId:string; strategyName:string;
  expectedValue:number; expectedCashVelocity:number; spend:number; capacityUnits:number;
  exploration:boolean; causalConfidence:number; marginalROI:number; jointScore:number; rationale:string[];
}
export interface CapitalPlan {
  budget:number; allocated:number; remaining:number; capacity:number; capacityUsed:number;
  explorationBudget:number; explorationAllocated:number; allocations:JointAllocation[];
  expectedCashGenerated:number; marginalROI:number; generatedAt:string;
}

type PlanDB=Awaited<ReturnType<typeof readDB>> & {capitalPlans?:CapitalPlan[]};

const num=(n:string,d:number)=>{const x=Number(process.env[n]);return Number.isFinite(x)&&x>=0?x:d;};
const ctxKey=(x:any)=>[x.industry,x.geography,x.opportunityType,x.leadStage,x.channel].map((v:string)=>(v||"unknown").toLowerCase()).join("|");

export async function optimizeJointCapital(missionId:string, capacity?:number):Promise<CapitalPlan>{
  const db=await readDB();
  const opportunities=db.opportunities.filter(o=>["new","qualified","contacted"].includes(o.status));
  const cap=capacity??Math.max(1,Math.floor(num("NORTHSTAR_DAILY_EXECUTION_CAPACITY",10)));
  const budget=num("NORTHSTAR_DAILY_EXECUTION_BUDGET_USD",25);
  const explorationBudget=budget*num("NORTHSTAR_EXPLORATION_BUDGET_RATE",.2);
  const candidates:JointAllocation[]=[];
  for(const o of opportunities){
    const economic=await scoreOpportunity(o.id);
    const actions=o.status==="new"?["build","outreach"]:["outreach","follow_up"];
    for(const action of actions){
      const strategy=await selectContextualStrategy(missionId,action,o.id);
      if(!strategy)continue;
      const spend=economic.acquisitionCost+economic.executionCost;
      const causalConfidence=strategy.confidence;
      const exploration=strategy.exploration;
      const uncertainty=Math.max(0,1-causalConfidence);
      const learningBonus=exploration?economic.learningValue*20*uncertainty:0;
      const jointScore=economic.expectedValue/Math.max(.01,spend)+economic.expectedCashVelocity+learningBonus;
      candidates.push({
        opportunityId:o.id,businessName:o.businessName,strategyVariantId:strategy.variant.id,strategyName:strategy.variant.name,
        expectedValue:economic.expectedValue,expectedCashVelocity:economic.expectedCashVelocity,spend,
        capacityUnits:1,exploration,causalConfidence,marginalROI:economic.expectedValue/Math.max(.01,spend),
        jointScore,rationale:[strategy.rationale,economic.rationale[0],exploration?"Allocation buys information where causal evidence is weak.":"Allocation exploits learned contextual evidence."]
      });
    }
  }
  candidates.sort((a,b)=>b.jointScore-a.jointScore);
  let allocated=0,capacityUsed=0,explorationAllocated=0,expectedCashGenerated=0;
  const allocations:JointAllocation[]=[];
  const used=new Set<string>();
  const contextCounts=new Map<string,number>();
  for(const c of candidates){
    if(used.has(c.opportunityId)||capacityUsed+c.capacityUnits>cap||allocated+c.spend>budget)continue;
    if(c.exploration&&explorationAllocated+c.spend>explorationBudget)continue;
    const key=ctxKey({industry:db.opportunities.find(o=>o.id===c.opportunityId)?.category,geography:db.opportunities.find(o=>o.id===c.opportunityId)?.location,opportunityType:db.opportunities.find(o=>o.id===c.opportunityId)?.websiteVerified===false?"website_gap":"revenue_opportunity",leadStage:"opportunity",channel:c.strategyName});
    const count=contextCounts.get(key)||0;
    if(count>=num("NORTHSTAR_CONTEXT_CAPACITY",3))continue;
    allocations.push(c);used.add(c.opportunityId);capacityUsed++;allocated+=c.spend;expectedCashGenerated+=Math.max(0,c.expectedValue);contextCounts.set(key,count+1);
    if(c.exploration)explorationAllocated+=c.spend;
  }
  const plan={budget,allocated,remaining:Math.max(0,budget-allocated),capacity:cap,capacityUsed,explorationBudget,explorationAllocated,allocations,expectedCashGenerated,marginalROI:allocations.length?allocations.reduce((s,x)=>s+x.marginalROI,0)/allocations.length:0,generatedAt:new Date().toISOString()};
  await updateDB(state=>{const d=state as PlanDB;d.capitalPlans??=[];d.capitalPlans.push(plan);d.capitalPlans=d.capitalPlans.slice(-20);return d;});
  return plan;
}

export async function getJointCapitalPlan(missionId:string){return optimizeJointCapital(missionId);}
