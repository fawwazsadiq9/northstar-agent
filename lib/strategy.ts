import { id } from "./id";
import { readDB, updateDB } from "./store";

export type StrategyChannel="website"|"outreach"|"follow_up"|"offer";
export interface StrategyContext { industry:string; geography:string; opportunityType:string; leadStage:string; channel:StrategyChannel; }
export interface StrategyVariant { id:string; name:string; description:string; context:StrategyContext; createdAt:string; }
export interface StrategyExperiment { id:string; missionId:string; context:StrategyContext; variants:string[]; assignments:number; createdAt:string; }
export interface StrategyObservation { id:string; experimentId:string; variantId:string; opportunityId?:string; leadId?:string; outcome:"pending"|"won"|"lost"|"failed"; revenue:number; createdAt:string; }

type StrategyDB=Awaited<ReturnType<typeof readDB>> & {strategyVariants?:StrategyVariant[];strategyExperiments?:StrategyExperiment[];strategyObservations?:StrategyObservation[]};
function sdb(db:Awaited<ReturnType<typeof readDB>>):StrategyDB{const d=db as StrategyDB;d.strategyVariants??=[];d.strategyExperiments??=[];d.strategyObservations??=[];return d;}

export async function ensureExperiment(missionId:string,context:StrategyContext){
 return updateDB(db=>{const d=sdb(db);let e=d.strategyExperiments!.find(x=>x.missionId===missionId&&JSON.stringify(x.context)===JSON.stringify(context));if(e)return e;
 const names=["control","aggressive_value","proof_first"];const variants=names.map((name,i)=>{const v={id:id("variant"),name,description:name==="control"?"Current baseline strategy":name==="aggressive_value"?"Lead with quantified revenue upside":"Lead with proof, audit evidence, and risk reversal",context,createdAt:new Date().toISOString()};d.strategyVariants!.push(v);return v.id;});
 e={id:id("experiment"),missionId,context,variants,assignments:0,createdAt:new Date().toISOString()};d.strategyExperiments!.push(e);return e;});
}

export async function assignStrategy(missionId:string,context:StrategyContext){
 const e=await ensureExperiment(missionId,context);return updateDB(db=>{const d=sdb(db);const exp=d.strategyExperiments!.find(x=>x.id===e.id)!;const counts=exp.variants.map(v=>({v,count:d.strategyObservations!.filter(o=>o.experimentId===e.id&&o.variantId===v).length}));const min=Math.min(...counts.map(x=>x.count));const chosen=counts.filter(x=>x.count===min)[Math.floor(Math.random()*counts.filter(x=>x.count===min).length)].v;exp.assignments++;return d.strategyVariants!.find(v=>v.id===chosen)!;});
}

export async function recordStrategyObservation(input:Omit<StrategyObservation,"id"|"createdAt">){
 return updateDB(db=>{const d=sdb(db);const o={...input,id:id("observation"),createdAt:new Date().toISOString()};d.strategyObservations!.unshift(o);return o;});
}

export async function strategyPerformance(){
 const d=sdb(await readDB());const result=d.strategyVariants!.map(v=>{const o=d.strategyObservations!.filter(x=>x.variantId===v.id),resolved=o.filter(x=>x.outcome!=="pending"),won=resolved.filter(x=>x.outcome==="won");return {variant:v,observations:o.length,resolved:resolved.length,winRate:resolved.length?won.length/resolved.length:0,revenue:won.reduce((s,x)=>s+x.revenue,0),avgRevenue:won.length?won.reduce((s,x)=>s+x.revenue,0)/won.length:0};});return result;
}
