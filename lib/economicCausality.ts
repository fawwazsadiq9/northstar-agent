import { readDB, updateDB } from "./store";
import type { Opportunity } from "./types";

export interface CausalContext { industry:string; geography:string; opportunityType:string; leadStage:string; channel:string; }
export interface CausalEstimate {
  key:string; context:CausalContext; controlN:number; treatmentN:number; controlWins:number; treatmentWins:number;
  controlWinRate:number; treatmentWinRate:number; winRateLift:number; controlRevenue:number; treatmentRevenue:number;
  controlRevenuePerOutcome:number; treatmentRevenuePerOutcome:number; revenueLift:number;
  treatmentLowerBound:number; controlUpperBound:number; confidence:number; credible:boolean; regret:number; updatedAt:string;
}
export interface EconomicRegret { id:string; opportunityId?:string; contextKey:string; selectedExpectedValue:number; realizedValue:number; regret:number; createdAt:string; }

type CausalDB=Awaited<ReturnType<typeof readDB>> & {
  strategyObservations?:Array<{variantId:string;opportunityId?:string;outcome:"pending"|"won"|"lost"|"failed";revenue:number}>;
  strategyVariants?:Array<{id:string;name:string;context?:CausalContext}>;
  economicCausalEstimates?:CausalEstimate[];
  economicRegret?:EconomicRegret[];
};

const key=(c:CausalContext)=>[c.industry,c.geography,c.opportunityType,c.leadStage,c.channel].map(x=>(x||"unknown").trim().toLowerCase()).join("|");
const wilsonLower=(wins:number,n:number,z=1.96)=>{if(!n)return 0;const p=wins/n,d=1+z*z/n,ctr=p+z*z/(2*n),m=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return Math.max(0,(ctr-m)/d);};
const wilsonUpper=(wins:number,n:number,z=1.96)=>{if(!n)return 1;const p=wins/n,d=1+z*z/n,ctr=p+z*z/(2*n),m=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return Math.min(1,(ctr+m)/d);};

function contextFor(o:Opportunity,variantName:string):CausalContext{
  return {industry:o.category||"unknown",geography:o.location||"unknown",opportunityType:o.websiteVerified===false?"website_gap":"revenue_opportunity",leadStage:"opportunity",channel:"outreach"};
}

export async function estimateEconomicCausality(){
  const db=await readDB() as CausalDB, rows=db.strategyObservations||[], variants=db.strategyVariants||[];
  const groups=new Map<string,{control:any[];treatment:any[]}>();
  for(const row of rows){
    if((row.outcome!=="won"&&row.outcome!=="lost")||!row.opportunityId)continue;
    const o=db.opportunities.find(x=>x.id===row.opportunityId); if(!o)continue;
    const v=variants.find(x=>x.id===row.variantId); if(!v)continue;
    const context=contextFor(o,v.name);
    const g=groups.get(key(context))||{control:[],treatment:[]};
    if(v.name.toLowerCase()==="current baseline strategy"||v.name.toLowerCase()==="control")g.control.push(row);else g.treatment.push(row);
    groups.set(key(context),g);
  }
  const estimates:CausalEstimate[]=[];
  for(const [k,g] of groups){
    const controlN=g.control.length,treatmentN=g.treatment.length;
    if(!controlN&&!treatmentN)continue;
    const controlWins=g.control.filter(x=>x.outcome==="won").length,treatmentWins=g.treatment.filter(x=>x.outcome==="won").length;
    const controlRevenue=g.control.reduce((s,x)=>s+(x.revenue||0),0),treatmentRevenue=g.treatment.reduce((s,x)=>s+(x.revenue||0),0);
    const cwr=controlN?controlWins/controlN:0,twr=treatmentN?treatmentWins/treatmentN:0;
    const cRev=controlN?controlRevenue/controlN:0,tRev=treatmentN?treatmentRevenue/treatmentN:0;
    const credible=controlN>=10&&treatmentN>=10&&wilsonLower(treatmentWins,treatmentN)>wilsonUpper(controlWins,controlN);
    estimates.push({key:k,context:{industry:g.control[0]&&""||"unknown",geography:"unknown",opportunityType:"unknown",leadStage:"opportunity",channel:"outreach"},controlN,treatmentN,controlWins,treatmentWins,controlWinRate:cwr,treatmentWinRate:twr,winRateLift:twr-cwr,controlRevenue,treatmentRevenue,controlRevenuePerOutcome:cRev,treatmentRevenuePerOutcome:tRev,revenueLift:tRev-cRev,treatmentLowerBound:wilsonLower(treatmentWins,treatmentN),controlUpperBound:wilsonUpper(controlWins,controlN),confidence:Math.min(1,Math.min(controlN,treatmentN)/30),credible,regret:Math.max(0,cRev-cRev),updatedAt:new Date().toISOString()});
    const last=estimates[estimates.length-1];
    const parts=k.split("|"); last.context={industry:parts[0],geography:parts[1],opportunityType:parts[2],leadStage:parts[3],channel:parts[4]};
    last.regret=Math.max(0,last.controlRevenuePerOutcome-last.treatmentRevenuePerOutcome);
  }
  await updateDB(state=>{(state as CausalDB).economicCausalEstimates=estimates;return state;});
  return estimates;
}

export async function recordEconomicRegret(input:{opportunityId?:string;contextKey:string;selectedExpectedValue:number;realizedValue:number}){
  const regret=Math.max(0,input.selectedExpectedValue-input.realizedValue);
  return updateDB(state=>{const d=state as CausalDB;d.economicRegret??=[];d.economicRegret.push({...input,id:"regret_"+crypto.randomUUID(),regret,createdAt:new Date().toISOString()});return d.economicRegret[d.economicRegret.length-1];});
}

export async function getEconomicCausality(){
  const estimates=await estimateEconomicCausality();
  const db=await readDB() as CausalDB;
  return {estimates,regret:db.economicRegret||[]};
}