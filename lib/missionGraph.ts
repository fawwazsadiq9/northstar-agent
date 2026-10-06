import { enqueueJob, type AgentJob } from "./controlPlane";
import { readDB, updateDB } from "./store";

export type MissionNodeKind = "discovery"|"build"|"outreach"|"follow_up"|"measurement";

export interface MissionNode {
  id:string; missionId:string; kind:MissionNodeKind; status:"pending"|"queued"|"running"|"succeeded"|"failed"|"blocked";
  dependsOn:string[]; jobId?:string; opportunityId?:string; approvalRequired?:boolean;
}

type GraphDB = Awaited<ReturnType<typeof readDB>> & { missionNodes?:MissionNode[] };

function graph(db:Awaited<ReturnType<typeof readDB>>):GraphDB {
  const d=db as GraphDB; d.missionNodes ??=[]; return d;
}

const plan: {kind:MissionNodeKind; dependsOn:MissionNodeKind[]; approvalRequired?:boolean}[]=[
  {kind:"discovery",dependsOn:[]},
  {kind:"build",dependsOn:["discovery"]},
  {kind:"outreach",dependsOn:["build"],approvalRequired:true},
  {kind:"follow_up",dependsOn:["outreach"],approvalRequired:true},
  {kind:"measurement",dependsOn:["follow_up"]}
];

export async function createMissionGraph(missionId:string) {
  return updateDB(db=>{
    const d=graph(db); if(d.missionNodes!.some(n=>n.missionId===missionId)) return d.missionNodes!.filter(n=>n.missionId===missionId);
    const nodes=plan.map((p,i)=>({id:`node_${missionId}_${p.kind}`,missionId,kind:p.kind,status:"pending" as const,dependsOn:p.dependsOn.map(k=>`node_${missionId}_${k}`),approvalRequired:p.approvalRequired}));
    d.missionNodes!.push(...nodes); return nodes;
  });
}

export async function advanceMissionGraph(missionId:string) {
  const db=graph(await readDB()); const nodes=db.missionNodes!.filter(n=>n.missionId===missionId);
  const created:AgentJob[]=[];
  for(const node of nodes) {
    if(node.status!=="pending") continue;
    const deps=nodes.filter(n=>node.dependsOn.includes(n.id));
    if(deps.some(d=>d.status==="failed")) {
      await updateDB(d=>{const n=graph(d).missionNodes!.find(x=>x.id===node.id);if(n)n.status="failed";});
      continue;
    }
    if(deps.some(d=>d.status!=="succeeded")) continue;
    if(node.approvalRequired) {
      await updateDB(d=>{const n=graph(d).missionNodes!.find(x=>x.id===node.id);if(n)n.status="blocked";});
      continue;
    }
    const job=await enqueueJob({
      kind:node.kind, missionId, opportunityId:node.opportunityId, payload:{nodeId:node.id},
      idempotencyKey:`mission-node:${node.id}`, maxAttempts:3, runAfter:new Date().toISOString()
    });
    await updateDB(d=>{const n=graph(d).missionNodes!.find(x=>x.id===node.id);if(n){n.status="queued";n.jobId=job.id;}});
    created.push(job);
  }
  return {nodes,created};
}

export async function approveMissionNode(nodeId:string) {
  return updateDB(db=>{const n=graph(db).missionNodes!.find(x=>x.id===nodeId);if(!n)throw Error("Mission node not found");if(n.status!=="blocked")throw Error("Only blocked nodes require approval");n.status="pending";n.approvalRequired=false;return n;});
}

export async function getMissionGraph(missionId:string) {
  return graph(await readDB()).missionNodes!.filter(n=>n.missionId===missionId);
}
