import { NextResponse } from "next/server";
import { audit } from "../../../lib/audit";
import { readDB, updateDB } from "../../../lib/store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.assetId) return NextResponse.json({ error:"assetId is required" }, { status:400 });

  const db = await readDB();
  const existing = db.assets.find(a => a.id === String(body.assetId));
  if (!existing) return NextResponse.json({ error:"Asset not found" }, { status:404 });
  if (existing.status === "published") return NextResponse.json({ approved:true, asset:existing, alreadyPublished:true });
  if (existing.type !== "website") return NextResponse.json({ error:"Only website assets can be approved for publishing" }, { status:400 });

  const asset = await updateDB(db => {
    const found = db.assets.find(a => a.id === String(body.assetId));
    if (!found) return null;
    found.status = "ready";
    return found;
  });
  if (!asset) return NextResponse.json({ error:"Asset not found" }, { status:404 });

  await audit("external_action.approved","user","asset",asset.id,{assetType:asset.type, action:"publish"});
  return NextResponse.json({ approved:true, nextAction:"POST /api/deployments", asset });
}
