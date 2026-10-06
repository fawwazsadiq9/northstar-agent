import { NextResponse } from "next/server";
import { readDB, updateDB } from "../../../lib/store";
import { discoverOpportunities } from "../../../lib/discovery";

export async function GET() {
  const db = await readDB();
  return NextResponse.json(db.opportunities);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const location = typeof body.location === "string" && body.location.trim()
    ? body.location.trim()
    : process.env.NORTHSTAR_DISCOVERY_LOCATION || "Austin, Texas";
  const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : undefined;
  const limit = Number.isFinite(body.limit) ? Math.min(Math.max(Number(body.limit), 1), 30) : 10;

  try {
    const discovered = await discoverOpportunities({ location, category, limit });
    const saved = await updateDB(db => {
      const existing = new Set(db.opportunities.map(o => o.sourceId).filter(Boolean));
      const fresh = discovered.filter(o => !o.sourceId || !existing.has(o.sourceId));
      db.opportunities.unshift(...fresh);
      return fresh;
    });
    return NextResponse.json({ source:"OpenStreetMap", count:saved.length, opportunities:saved }, { status:201 });
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error ? error.message : "Discovery failed" }, { status:502 });
  }
}
