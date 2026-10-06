import { readDB, updateDB } from "./store";
import type { Opportunity } from "./types";

export interface EconomicContext { industry:string; geography:string; opportunityType:string; strategy:string; }
export interface EconomicObservation {
  id:string; context:EconomicContext; opportunityId:string; action:string;
  acquisitionCost:number; executionCost:number; dealValue?:number; won:boolean;
  daysToCash?:number; createdAt:string;
}
export interface EconomicPrior {
  key:string; context:EconomicContext; observations:number; wins:number;
  winProbability:number; avgDealValue:number; avgAcquisitionCost:number;
  avgExecutionCost:number; avgDaysToCash:number; expectedRevenue:number;
  expectedValue:number; confidence:number; updatedAt:string;
}
type EconomicLearningDB=Awaited<ReturnType<typeof readDB>> & {
  economicObservations?:EconomicObservation[];
  economicPriors?:EconomicPrior[];
  strategyObservations?:Array<{variantId:string;opportunityId?:string;leadId?:string;outcome:"pending"|"won"|"lost"|"failed";revenue:number}>;
  strategyVariants?:Array<{id:string;name:string}>;
};

const uid=(prefix:string)=>prefix+"_"+crypto.randomUUID();
const keyOf=(c:EconomicContext)=>[c.industry,c.geography,c.opportunityType,c.strategy].map(x=>x.trim().toLowerCase()).join("|");
const contextFor=(o:Opportunity,strategy="baseline"):EconomicContext=>({
  industry:o.category||"unknown",
  geography:o.location||"unknown",
  opportunityType:o.websiteVerified===false?"website_gap":"revenue_opportunity",
  strategy
});

export function economicContext(opportunity:Opportunity,strategy="baseline"){return contextFor(opportunity,strategy);}

export async function recordEconomicObservation(input:Omit<EconomicObservation,"id"|"createdAt">){
  return updateDB(db=>{
    const d=db as EconomicLearningDB; d.economicObservations??=[];
    const duplicate=d.economicObservations.some(x=>x.opportunityId===input.opportunityId&&x.action===input.action&&x.won===input.won&&x.dealValue===input.dealValue);
    if(duplicate)return d.economicObservations.find(x=>x.opportunityId===input.opportunityId&&x.action===input.action);
    const row={...input,id:uid("econ_obs"),createdAt:new Date().toISOString()};
    d.economicObservations.push(row); return row;
  });
}

function prior(rows:EconomicObservation[],fallbackValue:number):EconomicPrior{
  const wins=rows.filter(x=>x.won).length;
  const n=rows.length;
  const priorWeight=5;
  const winProbability=(wins+0.6*priorWeight)/(n+priorWeight);
  const values=rows.filter(x=>typeof x.dealValue==="number").map(x=>x.dealValue as number);
  const costs=rows.map(x=>x.acquisitionCost+x.executionCost);
  const days=rows.filter(x=>typeof x.daysToCash==="number").map(x=>x.daysToCash as number);
  const avg=(xs:number[],fallback:number)=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:fallback;
  const avgDeal=avg(values,fallbackValue);
  const avgCost=avg(costs,1);
  const avgDays=avg(days,21);
  const expectedRevenue=winProbability*avgDeal;
  const expectedValue=expectedRevenue-avgCost;
  const confidence=Math.min(1,n/30);
  return {key:"",context:{industry:"",geography:"",opportunityType:"",strategy:""},observations:n,wins,winProbability,avgDealValue:avgDeal,avgAcquisitionCost:avg(rows.map(x=>x.acquisitionCost),.1),avgExecutionCost:avg(rows.map(x=>x.executionCost),.9),avgDaysToCash:avgDays,expectedRevenue,expectedValue,confidence,updatedAt:new Date().toISOString()};
}

export async function reconcileEconomicObservations(){
  const db=await readDB() as EconomicLearningDB;
  const observations=db.economicObservations??[];
  const strategyRows=db.strategyObservations??[];
  const variants=db.strategyVariants??[];
  for(const row of strategyRows){
    if(row.outcome!=="won"&&row.outcome!=="lost"||!row.opportunityId) continue;
    const opportunity=db.opportunities.find(o=>o.id===row.opportunityId);
    if(!opportunity) continue;
    const variant=variants.find(v=>v.id===row.variantId);
    const duplicate=observations.some(x=>x.opportunityId===opportunity.id&&x.action==="strategy:"+row.variantId);
    if(duplicate) continue;
    const wonDeal=db.deals.find(d=>d.opportunityId===opportunity.id&&d.status==="won");
    const economics=(db as EconomicLearningDB).opportunityEconomics?.find(x=>x.opportunityId===opportunity.id);
    const created=Date.parse(opportunity.createdAt);
    const closed=wonDeal?.closedAt?Date.parse(wonDeal.closedAt):Date.now();
    const daysToCash=Number.isFinite(created)&&closed>=created?Math.max(1,(closed-created)/86400000):undefined;
    observations.push({
      id:uid("econ_obs"),context:contextFor(opportunity,variant?.name||"baseline"),
      opportunityId:opportunity.id,action:"strategy:"+row.variantId,
      acquisitionCost:economics?.acquisitionCost??1,executionCost:economics?.executionCost??1,
      dealValue:wonDeal?.value??row.revenue??undefined,won:row.outcome==="won",daysToCash,
      createdAt:new Date().toISOString()
    });
  }
  await updateDB(state=>{(state as EconomicLearningDB).economicObservations=observations;});
  return observations;
}

export async function rebuildEconomicPriors(){
  await reconcileEconomicObservations();
  const db=await readDB() as EconomicLearningDB;
  const rows=db.economicObservations??[];
  const groups=new Map<string,EconomicObservation[]>();
  for(const row of rows){const key=keyOf(row.context);groups.set(key,[...(groups.get(key)||[]),row]);}
  const fallback:Record<string,number>={dental:1200,hvac:2500,roofing:8000,salon:500,auto:1800,restaurant:120,default:2000};
  const priors:EconomicPrior[]=[];
  for(const [key,group] of groups){
    const p=prior(group,fallback[group[0].context.industry.toLowerCase()]??fallback.default);
    p.key=key;p.context=group[0].context;priors.push(p);
  }
  await updateDB(state=>{
    const d=state as EconomicLearningDB;d.economicPriors=priors;return priors;
  });
  return priors;
}

export async function getEconomicLearning(){
  await rebuildEconomicPriors();
  const db=await readDB() as EconomicLearningDB;
  return {observations:db.economicObservations??[],priors:db.economicPriors??[]};
}
