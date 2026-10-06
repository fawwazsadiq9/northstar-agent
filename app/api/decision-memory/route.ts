import { NextResponse } from "next/server";
import { getDecisionLearning } from "../../../lib/decisionMemory";

export async function GET(){ return NextResponse.json(await getDecisionLearning()); }
