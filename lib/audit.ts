export type AuditAction =
  | "mission.created"
  | "opportunity.discovered"
  | "asset.generated"
  | "outreach.drafted"
  | "external_action.approved"
  | "external_action.executed";

export async function audit(action: AuditAction, actor: "system" | "user", targetType: string, targetId: string, detail: Record<string, unknown> = {}) {
  const { updateDB } = await import("./store");
  const { id } = await import("./id");
  await updateDB(db => {
    const events = (db as typeof db & { audit?: unknown[] }).audit ?? [];
    events.unshift({ id: id("audit"), action, actor, targetType, targetId, detail, createdAt: new Date().toISOString() });
    (db as typeof db & { audit: unknown[] }).audit = events;
  });
}
