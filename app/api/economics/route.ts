import { NextRequest, NextResponse } from "next/server";
import { getOpportunityEconomics } from "../../../lib/economicOptimizer";

export async function GET(req:NextRequest){
  try {
    const opportunityId=req.nextUrl.searchParams.get("opportunityId")||undefined;
    return NextResponse.json(await getOpportunityEconomics(opportunityId));
  } catch(e) {
    return NextResponse.json({error:e instanceof Error?e.message:"Economic model failed"},{status:400});
  }
}
