import { id } from "./id";
import { readDB, updateDB } from "./store";
import { reconcileStrategyOutcomes, strategyPerformance, type StrategyContext } from "./strategy";

export interface RevenueAttribution {
  id:string;
  experimentId:string;
  variantId:string;
  opportunityId?:string;
  leadId?:string;
  dealId?:string;
  context:StrategyContext;
  revenue:number;
  outcome:"won"|"lost";
  createdAt:string;
}

export interface StrategyLift {
  variantId:string;
  variantName:string;
  experimentId:string;
  context:StrategyContext;
  resolved:number;
  wins:number;
  revenue:number;
  winRate:number;
  revenuePerResolved:number;
  controlWinRate:number;
  controlRevenuePerResolved:number;
  winRateLift:number;
  revenueLift:number;
  confidence:number;
  eligibleForPlaybook:boolean;
}

type LearningDB=Awaited<ReturnType<typeof readDB>> & { strategyObservations?:Array<{id:string;experimentId:string;variantId:string;opportunityId?:string;leadId?:string;outcome:"pending"|"won"|"lost"|"failed";revenue:number;createdAt:string}>; strategyVariants?:Array<{id:string;name:string;description:string;context:StrategyContext;createdAt:string}>; strategyExperiments?:Array<{id:string;missionId:string;context:StrategyContext;variants:string[];assignments:number;createdAt:string}>;
  revenueAttributions?:RevenueAttribution[];
  strategyPlaybooks?:StrategyPlaybook[];
};

export interface StrategyPlaybook {
  id:string;
  key:string;
  context:StrategyContext;
  recommendedVariantId:string;
  recommendedVariantName:string;
  evidenceCount:number;
  winRate:number;
  revenuePerResolved:number;
  lift:number;
  confidence:number;
  updatedAt:string;
}

function ldb(db:Awaited<ReturnType<typeof readDB>>):LearningDB {
  const d=db as LearningDB;
  d.revenueAttributions??=[];
  d.strategyPlaybooks??=[];
  return d;
}

function wilsonLower(wins:number,n:number,z=1.96){
  if(!n)return 0;
  const p=wins/n, den=1+z*z/n;
  return (p+z*z/(2*n)-z*Math.sqrt((p*(1-p)+z*z/(4*n))/n))/den;
}

function contextKey(c:StrategyContext){
  return [c.industry,c.geography,c.opportunityType,c.leadStage,c.channel].map(x=>x.trim().toLowerCase()).join("|");
}

export async function reconcileRevenueAttribution(){
  await reconcileStrategyOutcomes();
  return updateDB(db=>{
    const d=ldb(db);
    for(const o of d.strategyObservations??[]){
      if(o.outcome!=="won"&&o.outcome!=="lost") continue;
      if(d.revenueAttributions!.some(a=>a.experimentId===o.experimentId&&a.variantId===o.variantId&&a.opportunityId===o.opportunityId&&a.leadId===o.leadId)) continue;
      const v=d.strategyVariants?.find(x=>x.id===o.variantId);
      if(!v) continue;
      const deal=o.opportunityId ? d.deals.find(x=>x.opportunityId===o.opportunityId&&x.status==="won") : undefined;
      d.revenueAttributions!.push({
        id:id("attribution"),
        experimentId:o.experimentId,
        variantId:o.variantId,
        opportunityId:o.opportunityId,
        leadId:o.leadId,
        dealId:deal?.id,
        context:v.context,
        revenue:o.outcome==="won" ? (o.revenue||deal?.value||0) : 0,
        outcome:o.outcome,
        createdAt:new Date().toISOString()
      });
    }
    return d.revenueAttributions!;
  });
}

export async function strategyLifts():Promise<StrategyLift[]>{
  await reconcileRevenueAttribution();
  const d=ldb(await readDB());
  const variants=d.strategyVariants??[];
  const result:StrategyLift[]=[];
  for(const v of variants){
    const exp=d.strategyExperiments?.find(x=>x.variants.includes(v.id));
    if(!exp) continue;
    const rows=(d.revenueAttributions??[]).filter(a=>a.experimentId===exp.id&&a.variantId===v.id);
    const controlId=exp.variants.find(id=>d.strategyVariants?.find(vv=>vv.id===id)?.name==="control");
    const control=(d.revenueAttributions??[]).filter(a=>a.experimentId===exp.id&&a.variantId===controlId);
    const resolved=rows.length,wins=rows.filter(x=>x.outcome==="won").length;
    const controlResolved=control.length,controlWins=control.filter(x=>x.outcome==="won").length;
    const revenue=rows.reduce((s,x)=>s+x.revenue,0),controlRevenue=control.reduce((s,x)=>s+x.revenue,0);
    const winRate=resolved?wins/resolved:0,controlWinRate=controlResolved?controlWins/controlResolved:0;
    const rpr=resolved?revenue/resolved:0,controlRpr=controlResolved?controlRevenue/controlResolved:0;
    const sampleConfidence=Math.min(1,Math.max(0,Math.min(resolved,controlResolved)/20));
    const lower=wilsonLower(wins,resolved), controlUpper=controlResolved?Math.min(1,controlWinRate+(1-wilsonLower(controlResolved-controlWins,controlResolved))):1;
    const lift=controlWinRate?winRate/controlWinRate-1:0;
    const revenueLift=controlRpr? rpr/controlRpr-1 : 0;
    result.push({variantId:v.id,variantName:v.name,experimentId:exp.id,context:v.context,resolved,wins,revenue,winRate,revenuePerResolved:rpr,controlWinRate,controlRevenuePerResolved:controlRpr,winRateLift:lift,revenueLift,confidence:sampleConfidence,eligibleForPlaybook:resolved>=10&&controlResolved>=10&&lower>controlUpper});
  }
  return result;
}

export async function buildPlaybooks(){
  const lifts=await strategyLifts();
  return updateDB(db=>{
    const d=ldb(db);
    const groups=new Map<string,StrategyLift[]>();
    for(const x of lifts){const key=contextKey(x.context);groups.set(key,[...(groups.get(key)||[]),x]);}
    for(const [key,rows] of groups){
      const eligible=rows.filter(x=>x.eligibleForPlaybook);
      if(!eligible.length) continue;
      const winner=eligible.sort((a,b)=>b.revenueLift-a.revenueLift||b.winRateLift-a.winRateLift)[0];
      const existing=d.strategyPlaybooks!.find(p=>p.key===key);
      const item={id:existing?.id||id("playbook"),key,context:winner.context,recommendedVariantId:winner.variantId,recommendedVariantName:winner.variantName,evidenceCount:winner.resolved,winRate:winner.winRate,revenuePerResolved:winner.revenuePerResolved,lift:winner.revenueLift,confidence:winner.confidence,updatedAt:new Date().toISOString()};
      if(existing) Object.assign(existing,item); else d.strategyPlaybooks!.push(item);
    }
    return d.strategyPlaybooks!;
  });
}

export async function getRevenueLearning(){
  const [lifts,playbooks,performance]=await Promise.all([strategyLifts(),buildPlaybooks(),strategyPerformance()]);
  const totalRevenue=lifts.reduce((s,x)=>s+x.revenue,0);
  return {attributionCount:(await readDB() as LearningDB).revenueAttributions?.length||0,totalRevenue,lifts,playbooks,performance};
}
