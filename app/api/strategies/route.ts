import { NextResponse } from "next/server";
import { assignStrategy, strategyPerformance } from "../../../lib/strategy";
export async function GET(){return NextResponse.json(await strategyPerformance());}
export async function POST(req:Request){const b=await req.json();if(!b.missionId||!b.context)return NextResponse.json({error:"missionId and context required"},{status:400});return NextResponse.json(await assignStrategy(b.missionId,b.context));}
