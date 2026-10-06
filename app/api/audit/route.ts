import { NextResponse } from "next/server";
import { readDB } from "../../../lib/store";
export async function GET() {
  const db = await readDB();
  return NextResponse.json((db as typeof db & { audit?: unknown[] }).audit ?? []);
}