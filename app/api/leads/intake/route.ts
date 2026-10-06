import { NextResponse } from "next/server";
import { id } from "../../../../lib/id";
import { updateDB } from "../../../../lib/store";
import { audit } from "../../../../lib/audit";
import type { LeadStatus } from "../../../../lib/types";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (clean(body.company, 100)) return NextResponse.json({ accepted: true });

  const opportunityId = clean(body.opportunityId, 120);
  const name = clean(body.name, 120);
  const email = clean(body.email, 240).toLowerCase();
  const phone = clean(body.phone, 60);
  const message = clean(body.message, 2000);

  if (!opportunityId || !name || !email || !email.includes("@")) {
    return NextResponse.json({ error: "opportunityId, name and valid email are required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const lead = {
    id: id("lead"),
    opportunityId,
    name,
    email,
    phone: phone || undefined,
    message: message || undefined,
    status: "new" as LeadStatus,
    source: clean(body.source, 50) || "website",
    createdAt: now
  };

  try {
    const saved = await updateDB(db => {
      if (!db.opportunities.some(o => o.id === opportunityId)) throw new Error("Opportunity not found");
      db.leads.unshift(lead);
      return lead;
    });
    await audit("lead.created", "external", "lead", saved.id, {
      opportunityId,
      source: saved.source
    });
    return NextResponse.json({ accepted: true, leadId: saved.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Lead intake failed" }, { status: 404 });
  }
}
