import { readDB, updateDB } from "./store";
import type { Opportunity, Lead, Deal } from "./types";

export interface EconomicModel {
  opportunityId:string; businessName:string; expectedDealValue:number; winProbability:number;
  acquisitionCost:number; executionCost:number; riskPenalty:number; expectedRevenue:number;
  expectedValue:number; expectedCashVelocity:number; expectedDaysToCash:number; learningValue:number;
  economicScore:number; recommendation:"pursue"|"explore"|"defer"|"reject"; rationale:string[]; assumptions:string[];
}
export interface EconomicPortfolio { budget:number; allocated:number; remaining:number; ranked:EconomicModel[]; generatedAt:string; }
type EconomicDB=Awaited<ReturnType<typeof readDB>> & { opportunityEconomics?:EconomicModel[] };

function dealPrior(category:string){const v:Record<string,number>={dental:1200,hvac:2500,roofing:8000,salon:500,auto:1800,restaurant:120,default:2000};return v[category.trim().toLowerCase()]??v.default;}
function envNumber(name:string,fallback:number){const n=Number(process.env[name]);return Number.isFinite(n)&&n>=0?n:fallback;}

function estimateWinProbability(db:Awaited<ReturnType<typeof readDB>>,o:Opportunity){
  const historical=db.opportunities.filter(x=>x.category.toLowerCase()===o.category.toLowerCase());
  const won=historical.filter(x=>db.deals.some(d=>d.opportunityId===x.id&&d.status==="won")).length;
  const resolved=historical.filter(x=>x.status==="won"||x.status==="lost"||db.deals.some(d=>d.opportunityId===x.id&&(d.status==="won"||d.status==="lost"))).length;
  const empirical=resolved>=5?won/resolved:0.12;
  const scorePrior=Math.max(.02,Math.min(.45,o.score/100*.35));
  const contactPrior=o.contactEmail?0.08:0;
  const phonePrior=o.phone?0.03:0;
  const base=resolved>=5?.65*empirical+.35*scorePrior:scorePrior;
  return Math.max(.02,Math.min(.75,base+contactPrior+phonePrior));
}
function estimateDealValue(db:Awaited<ReturnType<typeof readDB>>,o:Opportunity){
  const won=db.deals.filter(d=>d.opportunityId===o.id&&d.status==="won");
  return won.length?won.reduce((s,d)=>s+d.value,0)/won.length:dealPrior(o.category);
}
function estimateDays(o:Opportunity,leads:Lead[],deals:Deal[]){
  if(deals.some(d=>d.status==="won"))return 1;
  const lead=leads.find(l=>l.opportunityId===o.id);
  if(lead?.status==="meeting")return 7;if(lead?.status==="replied")return 10;if(lead)return 14;
  return o.contactEmail?21:30;
}

export async function scoreOpportunity(opportunityId:string):Promise<EconomicModel>{
  const db=await readDB(),o=db.opportunities.find(x=>x.id===opportunityId);if(!o)throw new Error("Opportunity not found");
  const expectedDealValue=estimateDealValue(db,o),winProbability=estimateWinProbability(db,o);
  const leads=db.leads.filter(l=>l.opportunityId===o.id),deals=db.deals.filter(d=>d.opportunityId===o.id);
  const acquisitionCost=(o.contactEmail?envNumber("NORTHSTAR_OUTREACH_COST_USD",.25):envNumber("NORTHSTAR_DISCOVERY_COST_USD",.10))+(leads.length*envNumber("NORTHSTAR_FOLLOWUP_COST_USD",.10));
  const executionCost=envNumber("NORTHSTAR_AI_ACTION_COST_USD",.75)+envNumber("NORTHSTAR_TOOL_COST_USD",.25)+(o.contactEmail?envNumber("NORTHSTAR_BUILD_COST_USD",.50):envNumber("NORTHSTAR_BUILD_COST_USD",.75));
  const riskPenalty=expectedDealValue*(1-winProbability)*envNumber("NORTHSTAR_RISK_RATE",.08);
  const expectedRevenue=winProbability*expectedDealValue,expectedValue=expectedRevenue-acquisitionCost-executionCost-riskPenalty;
  const expectedDaysToCash=estimateDays(o,leads,deals),expectedCashVelocity=expectedValue/Math.max(1,expectedDaysToCash);
  const learningValue=(o.contactEmail?0.5:0.2)+(o.websiteVerified===false?0.4:0)+(db.opportunities.filter(x=>x.category===o.category).length<20?0.6:0);
  const rationale:string[]=[];
  rationale.push(expectedValue>0?"Positive estimated economic value after modeled costs and risk.":"Estimated value is non-positive after modeled costs and risk.");
  if(expectedCashVelocity>0)rationale.push("Estimated cash velocity is $"+expectedCashVelocity.toFixed(0)+"/day.");
  if(o.contactEmail)rationale.push("A direct contact path reduces acquisition friction.");
  if(o.websiteVerified===false)rationale.push("A verified website gap increases the value of a website-led experiment.");
  const recommendation:EconomicModel["recommendation"] = expectedValue<=0?"reject":expectedCashVelocity>=envNumber("NORTHSTAR_PURSUIT_VELOCITY_USD_PER_DAY",50)?"pursue":learningValue>=.7?"explore":"defer";
  const economicScore=Math.max(0,Math.min(100,50+expectedCashVelocity/Math.max(1,envNumber("NORTHSTAR_SCORE_DOLLARS_PER_DAY",100))*50+learningValue*10-(expectedValue<0?40:0)));
  return {opportunityId:o.id,businessName:o.businessName,expectedDealValue,winProbability,acquisitionCost,executionCost,riskPenalty,expectedRevenue,expectedValue,expectedCashVelocity,expectedDaysToCash,learningValue,economicScore,recommendation,rationale,assumptions:["Deal value is a category prior until Northstar has enough resolved deals.","Win probability is an estimate until sufficient resolved outcomes exist.","Acquisition and execution costs are configurable estimates, not provider invoices."]};
}
export async function rankOpportunities(limit=25):Promise<EconomicPortfolio>{
  const db=await readDB(),candidates=db.opportunities.filter(o=>["new","qualified","contacted"].includes(o.status));
  const ranked=(await Promise.all(candidates.map(o=>scoreOpportunity(o.id)))).sort((a,b)=>b.expectedCashVelocity-a.expectedCashVelocity);
  const budget=envNumber("NORTHSTAR_DAILY_EXECUTION_BUDGET_USD",25);let allocated=0;const selected:EconomicModel[]=[];
  for(const model of ranked.slice(0,limit)){const spend=model.acquisitionCost+model.executionCost;if(model.recommendation!=="reject"&&allocated+spend<=budget){allocated+=spend;selected.push(model);}}
  await updateDB(dbState=>{const d=dbState as EconomicDB;d.opportunityEconomics??=[];for(const model of ranked){const existing=d.opportunityEconomics.find(x=>x.opportunityId===model.opportunityId);if(existing)Object.assign(existing,model);else d.opportunityEconomics.push(model);}});
  return {budget,allocated,remaining:Math.max(0,budget-allocated),ranked:selected,generatedAt:new Date().toISOString()};
}
export async function getOpportunityEconomics(opportunityId?:string){return opportunityId?scoreOpportunity(opportunityId):rankOpportunities();}
