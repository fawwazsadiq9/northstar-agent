import { selectContextualStrategy } from "../../../lib/strategyOptimizer";
import { strategyPerformance } from "../../../lib/strategy";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const missionId = url.searchParams.get("missionId");
  const action = url.searchParams.get("action") || "outreach";
  if (!missionId) return Response.json({ error: "missionId is required" }, { status: 400 });
  const selection = await selectContextualStrategy(missionId, action, url.searchParams.get("opportunityId") || undefined, url.searchParams.get("leadId") || undefined);
  return Response.json({ selection, performance: await strategyPerformance() });
}
