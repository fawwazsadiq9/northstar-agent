import { NextResponse } from "next/server";
import { readDB } from "../../../../lib/store";
import { buildRevenueAudit } from "../../../../lib/revenueAudit";

export async function GET(request: Request) {
  const opportunityId = new URL(request.url).searchParams.get("opportunityId");
  if (!opportunityId) return NextResponse.json({ error: "opportunityId is required" }, { status: 400 });

  const db = await readDB();
  const opportunity = db.opportunities.find(o => o.id === opportunityId);
  if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  return NextResponse.json(buildRevenueAudit(opportunity));
}
