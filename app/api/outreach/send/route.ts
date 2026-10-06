import { NextResponse } from "next/server";
import { audit } from "../../../../lib/audit";
import { readDB, updateDB } from "../../../../lib/store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.assetId) return NextResponse.json({ error: "assetId is required" }, { status: 400 });

  const db = await readDB();
  const asset = db.assets.find(a => a.id === String(body.assetId));
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  if (asset.type !== "email") return NextResponse.json({ error: "Only email assets can be sent" }, { status: 400 });
  if (asset.status !== "ready") return NextResponse.json({ error: "Email must be explicitly approved before sending" }, { status: 403 });

  const opportunity = db.opportunities.find(o => o.id === asset.opportunityId);
  if (!opportunity?.contactEmail) {
    return NextResponse.json({ error: "No public contact channel is available for this opportunity" }, { status: 422 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return NextResponse.json({ error: "Resend is not configured. Set RESEND_API_KEY and RESEND_FROM after verifying a sending domain." }, { status: 503 });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [opportunity.contactEmail],
        subject: `A revenue opportunity for ${opportunity.businessName}`,
        text: asset.content
      }),
      cache: "no-store"
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data?.message === "string" ? data.message : "Resend rejected the message");
    }

    await updateDB(db => {
      const current = db.assets.find(a => a.id === asset.id);
      if (current) current.status = "published";
      const target = db.opportunities.find(o => o.id === asset.opportunityId);
      if (target) target.status = "contacted";
    });

    await audit("external_action.executed", "user", "asset", asset.id, {
      action: "resend_send",
      providerMessageId: typeof data?.id === "string" ? data.id : undefined,
      recipient: opportunity.contactEmail
    });

    return NextResponse.json({ sent: true, providerMessageId: data?.id || null });
  } catch (error) {
    await audit("external_action.executed", "user", "asset", asset.id, {
      action: "resend_send",
      success: false,
      error: error instanceof Error ? error.message : "Send failed"
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Send failed" }, { status: 502 });
  }
}
