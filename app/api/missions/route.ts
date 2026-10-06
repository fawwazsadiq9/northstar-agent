import { NextResponse } from "next/server";
import { createMission } from "../../../lib/mission";
import { readDB } from "../../../lib/store";

export async function GET() {
  const db = await readDB();
  return NextResponse.json(db.missions);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const objective = typeof body.objective === "string" && body.objective.trim()
    ? body.objective.trim()
    : "Find and pursue the highest-value next revenue opportunity.";
  const mission = await createMission(objective);
  return NextResponse.json(mission, { status: 201 });
}