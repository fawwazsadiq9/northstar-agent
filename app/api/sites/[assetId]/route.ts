import { NextResponse } from "next/server";
import { readDB } from "../../../../lib/store";

export async function GET(_: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  const db = await readDB();
  const asset = db.assets.find(a => a.id === assetId && a.type === "website");
  if (!asset) return new NextResponse("Website asset not found", { status: 404 });
  return new NextResponse(asset.content, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Northstar-Asset-Status": asset.status }
  });
}
