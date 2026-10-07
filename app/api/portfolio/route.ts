import { optimizeEconomicPortfolio } from "@/lib/portfolioOptimizer";
import { getEconomicCausality } from "@/lib/economicCausality";
export async function GET(){try{return Response.json({portfolio:await optimizeEconomicPortfolio(),causality:await getEconomicCausality()});}catch(e){return Response.json({error:e instanceof Error?e.message:"Portfolio optimization failed"},{status:500});}}