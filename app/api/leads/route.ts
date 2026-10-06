import { NextResponse } from "next/server";
import { readDB, updateDB } from "../../../lib/store";
import { id } from "../../../lib/id";

export async function GET() {
  return NextResponse.json((await readDB()).leads);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.opportunityId || !body.name) return NextResponse.json({ error: "opportunityId and name are required" }, { status: 400 });
  const lead = {
    id: id("lead"), opportunityId: String(body.opportunityId), name: String(body.name),
    email: body.email ? String(body.email) : undefined, phone: body.phone ? String(body.phone) : undefined,
    status: "new" as const, source: body.source ? String(body.source) : "northstar",
    createdAt: new Date().toISOString()
  };
  await updateDB(db => db.leads.unshift(lead));
  return NextResponse.json(lead, { status: 201 });
}