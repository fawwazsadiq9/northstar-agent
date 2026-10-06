import { NextResponse } from "next/server";
import { runMission } from "../../../../lib/mission";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.missionId !== "string" || !body.missionId) {
    return NextResponse.json({ error: "missionId is required" }, { status: 400 });
  }
  try {
    const mission = await runMission(body.missionId);
    return NextResponse.json(mission);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mission execution failed" }, { status: 500 });
  }
}
