import { NextResponse } from "next/server";
import { readDB } from "../../../lib/store";
import { generateOffer, generateWebsiteBlueprint, draftOutreach } from "../../../lib/operator";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const db = await readDB();
  const opportunity = db.opportunities.find(o => o.id === body.opportunityId);
  if (!opportunity) return NextResponse.json({ error:"Opportunity not found" }, { status:404 });
  try {
    if (body.action === "offer") return NextResponse.json(await generateOffer(opportunity), { status:201 });
    if (body.action === "website") return NextResponse.json(await generateWebsiteBlueprint(opportunity), { status:201 });
    if (body.action === "outreach") return NextResponse.json(await draftOutreach(opportunity), { status:201 });
    return NextResponse.json({ error:"action must be offer, website, or outreach" }, { status:400 });
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error ? error.message : "Operator failed" }, { status:500 });
  }
}