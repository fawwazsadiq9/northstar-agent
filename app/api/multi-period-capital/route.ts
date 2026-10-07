import { getMultiPeriodCapitalPlan, optimizeMultiPeriodCapital } from "../../../lib/multiPeriodCapital";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const missionId = url.searchParams.get("missionId");
  if (!missionId) return Response.json({ error: "missionId is required" }, { status: 400 });
  const plan = await getMultiPeriodCapitalPlan(missionId);
  return Response.json(plan || await optimizeMultiPeriodCapital(missionId));
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (!body.missionId) return Response.json({ error: "missionId is required" }, { status: 400 });
    const plan = await optimizeMultiPeriodCapital(body.missionId, {
      horizon: body.horizon,
      budget: body.budget,
      capacity: body.capacity,
      explorationRate: body.explorationRate,
    });
    return Response.json(plan);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Multi-period planning failed" },
      { status: 500 },
    );
  }
}
