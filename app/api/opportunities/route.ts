import { NextResponse } from "next/server";
import { readDB, updateDB } from "../../../lib/store";
import { discoverOpportunities } from "../../../lib/discovery";

export async function GET() {
  return NextResponse.json((await readDB()).opportunities);
}

export async function POST() {
  const opportunities = discoverOpportunities();
  await updateDB(db => db.opportunities.unshift(...opportunities));
  return NextResponse.json(opportunities, { status: 201 });
}