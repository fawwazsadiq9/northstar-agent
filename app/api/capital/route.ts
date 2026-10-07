import { getJointCapitalPlan } from "../../../lib/jointCapitalOptimizer";
export async function GET(request:Request){
  const missionId=new URL(request.url).searchParams.get("missionId");
  if(!missionId)return Response.json({error:"missionId is required"},{status:400});
  try{return Response.json(await getJointCapitalPlan(missionId));}
  catch(e){return Response.json({error:e instanceof Error?e.message:"Joint capital optimization failed"},{status:500});}
}