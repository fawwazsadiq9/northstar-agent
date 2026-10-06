import { readDB } from "../../../../lib/store";
import { buildOrangeDataset, orangeReadiness } from "../../../../lib/orangeIntelligence";

export async function GET() {
  const db = await readDB();
  const csv = buildOrangeDataset(db);
  const readiness = orangeReadiness(db);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="northstar-orange-opportunities.csv"',
      "X-Northstar-Orange-Opportunities": String(readiness.opportunities),
      "X-Northstar-Orange-Labeled": String(readiness.labeledOpportunities)
    }
  });
}

export async function HEAD() {
  const db = await readDB();
  const readiness = orangeReadiness(db);
  return Response.json(readiness);
}
