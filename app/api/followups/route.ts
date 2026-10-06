import { NextResponse } from "next/server";
import { runDueFollowUps } from "../../../lib/revenueExecution";

export async function POST(request: Request) {
  const secret = process.env.NORTHSTAR_CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runDueFollowUps());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Follow-up run failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
