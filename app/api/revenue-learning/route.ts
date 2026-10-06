import { getRevenueLearning } from "../../../lib/revenueLearning";

export async function GET(){
  return Response.json(await getRevenueLearning());
}
