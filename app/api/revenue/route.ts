import { NextResponse } from "next/server";
import { readDB, updateDB } from "../../../lib/store";
import { id } from "../../../lib/id";

export async function GET() {
  const db = await readDB();
  const won = db.revenue.filter(x => x.type === "won" || x.type === "payment").reduce((n, x) => n + x.amount, 0);
  const pipeline = db.revenue.filter(x => x.type === "pipeline").reduce((n, x) => n + x.amount, 0);
  return NextResponse.json(db.revenue);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.type || typeof body.amount !== "number") return NextResponse.json({ error: "type and numeric amount are required" }, { status: 400 });
  const event = {
    id: id("rev"), opportunityId: body.opportunityId ? String(body.opportunityId) : undefined,
    type: body.type, amount: body.amount, currency: body.currency || "USD",
    note: body.note || "", createdAt: new Date().toISOString()
  };
  await updateDB(db => db.revenue.unshift(event));
  return NextResponse.json(event, { status: 201 });
}