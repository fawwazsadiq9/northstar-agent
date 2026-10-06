import { NextResponse } from "next/server";
import { readDB, updateDB } from "../../../lib/store";
import { audit } from "../../../lib/audit";

async function deployToVercel(name: string, html: string) {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN is not configured");
  const project = process.env.NORTHSTAR_VERCEL_PROJECT;

  const body: Record<string, unknown> = {
    name,
    files: [{ file: "index.html", data: html, encoding: "utf-8" }],
    projectSettings: { framework: null },
    target: "production"
  };
  if (project) body.project = project;

  const response = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error?.message === "string" ? data.error.message : "Vercel deployment failed");
  }

  return {
    id: String(data.id),
    url: typeof data.url === "string" ? `https://${data.url}` : undefined,
    readyState: data.readyState
  };
}

function deploymentName(assetId: string) {
  return `northstar-site-${assetId.replace(/[^a-zA-Z0-9-]/g, "").slice(-32)}`.toLowerCase();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.assetId) return NextResponse.json({ error: "assetId is required" }, { status: 400 });

  const db = await readDB();
  const asset = db.assets.find(a => a.id === String(body.assetId));
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  if (asset.type !== "website") {
    return NextResponse.json({ error: "Only website assets can be deployed" }, { status: 400 });
  }
  if (asset.status !== "ready") {
    return NextResponse.json({ error: "Website must be explicitly approved before deployment" }, { status: 403 });
  }
  if (!asset.content.toLowerCase().includes("<html")) {
    return NextResponse.json({ error: "Website asset is not valid HTML" }, { status: 422 });
  }

  try {
    const deployment = await deployToVercel(deploymentName(asset.id), asset.content);
    if (!deployment.url) throw new Error("Vercel returned no deployment URL");

    const updated = await updateDB(db => {
      const current = db.assets.find(a => a.id === asset.id);
      if (!current) return null;
      current.status = "published";
      current.deploymentUrl = deployment.url;
      const opportunity = db.opportunities.find(o => o.id === current.opportunityId);
      if (opportunity) opportunity.deployedWebsiteUrl = deployment.url;
      return current;
    });

    await audit("external_action.executed", "user", "asset", asset.id, {
      action: "vercel_deploy",
      deploymentId: deployment.id,
      deploymentUrl: deployment.url
    });

    return NextResponse.json({ deployed: true, deployment, asset: updated });
  } catch (error) {
    await audit("external_action.executed", "user", "asset", asset.id, {
      action: "vercel_deploy",
      success: false,
      error: error instanceof Error ? error.message : "Deployment failed"
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Deployment failed" }, { status: 502 });
  }
}
