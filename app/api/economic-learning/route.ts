import { NextResponse } from "next/server";
import { getEconomicLearning } from "../../../lib/economicLearning";
export async function GET(){try{return NextResponse.json(await getEconomicLearning());}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Economic learning failed"},{status:500});}}
