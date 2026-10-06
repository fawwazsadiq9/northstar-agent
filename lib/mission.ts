import { updateDB } from "./store";
import { id } from "./id";
import { discoverOpportunities } from "./discovery";
import type { Mission } from "./types";

const stages = ["discover", "qualify", "build", "prepare outreach", "queue follow-up", "measure"];

export async function createMission(objective: string): Promise<Mission> {
  const now = new Date().toISOString();
  const mission: Mission = { id: id("mission"), objective, status: "queued", progress: 0, currentStage: "queued", createdAt: now, updatedAt: now };
  await updateDB(db => { db.missions.unshift(mission); });
  return mission;
}

export async function runMission(missionId: string) {
  return updateDB(async db => {
    const mission = db.missions.find(m => m.id === missionId);
    if (!mission) throw new Error("Mission not found");

    mission.status = "running";
    mission.updatedAt = new Date().toISOString();

    const opportunities = discoverOpportunities();
    db.opportunities.unshift(...opportunities);

    for (let i = 0; i < stages.length; i++) {
      mission.currentStage = stages[i];
      mission.progress = Math.round(((i + 1) / stages.length) * 100);
      mission.updatedAt = new Date().toISOString();

      if (stages[i] === "build") {
        for (const opp of opportunities.slice(0, 3)) {
          db.assets.unshift({
            id: id("asset"), opportunityId: opp.id, type: "offer",
            title: "Revenue recovery offer",
            content: `We identified a conversion opportunity for ${opp.businessName}. Northstar can deploy an automated lead-response and follow-up workflow designed around ${opp.category.toLowerCase()} demand in ${opp.location}.`,
            status: "ready", createdAt: new Date().toISOString()
          });
        }
      }
    }

    mission.status = "completed";
    mission.currentStage = "complete";
    mission.progress = 100;
    mission.updatedAt = new Date().toISOString();
    return mission;
  });
}