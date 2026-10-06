import { updateDB, readDB } from "./store";
import { id } from "./id";
import { discoverOpportunities } from "./discovery";
import { generateWebsite } from "./operator";
import type { Mission } from "./types";

const stages = ["discover", "qualify", "build", "prepare outreach", "queue follow-up", "measure"];

function discoveryLocation(objective: string) {
  const configured = process.env.NORTHSTAR_DISCOVERY_LOCATION;
  if (configured) return configured;
  const match = objective.match(/(?:in|near|around)\s+([^,.]+(?:,\s*[^,.]+)?)/i);
  return match?.[1] || "Austin, Texas";
}

export async function createMission(objective: string): Promise<Mission> {
  const now = new Date().toISOString();
  const mission: Mission = { id: id("mission"), objective, status: "queued", progress: 0, currentStage: "queued", createdAt: now, updatedAt: now };
  await updateDB(db => { db.missions.unshift(mission); });
  return mission;
}

export async function runMission(missionId: string) {
  const current = await readDB();
  const mission = current.missions.find(m => m.id === missionId);
  if (!mission) throw new Error("Mission not found");

  const opportunities = await discoverOpportunities({ location: discoveryLocation(mission.objective), limit: 10 });

  const fresh = await updateDB(db => {
    const target = db.missions.find(m => m.id === missionId);
    if (!target) throw new Error("Mission not found");
    target.status = "running";
    target.currentStage = "discover";
    target.progress = Math.round((1 / stages.length) * 100);
    target.updatedAt = new Date().toISOString();

    const existing = new Set(db.opportunities.map(o => o.sourceId).filter(Boolean));
    const newOpportunities = opportunities.filter(o => !o.sourceId || !existing.has(o.sourceId));
    db.opportunities.unshift(...newOpportunities);
    return newOpportunities;
  });

  const topOpportunity = fresh[0];
  if (topOpportunity) {
    const db = await readDB();
    const hasWebsite = db.assets.some(a => a.opportunityId === topOpportunity.id && a.type === "website");
    if (!hasWebsite) await generateWebsite(topOpportunity);\n    if (topOpportunity.contactEmail && process.env.AI_GATEWAY_API_KEY) {\n      const hasOutreach = db.assets.some(a => a.opportunityId === topOpportunity.id && a.type === "email");\n      if (!hasOutreach) await (await import("./operator")).draftOutreach(topOpportunity);\n    }
  }

  return updateDB(db => {
    const target = db.missions.find(m => m.id === missionId);
    if (!target) throw new Error("Mission not found");

    for (let i = 1; i < stages.length; i++) {
      target.currentStage = stages[i];
      target.progress = Math.round(((i + 1) / stages.length) * 100);
      target.updatedAt = new Date().toISOString();
    }

    target.status = "completed";
    target.currentStage = "complete";
    target.progress = 100;
    target.updatedAt = new Date().toISOString();
    return target;
  });
}
