"use client";

import { useEffect, useMemo, useState } from "react";

type Mission = { id:string; objective:string; status:string; progress:number; currentStage:string; updatedAt:string };
type Opportunity = { id:string; businessName:string; website?:string; deployedWebsiteUrl?:string; category:string; location:string; score:number; status:string };
type Asset = { id:string; opportunityId:string; type:"website"|"offer"|"email"; title:string; content:string; status:"draft"|"ready"|"published"; deploymentUrl?:string; createdAt:string };\ntype RevenueAudit = { opportunityId:string; businessName:string; score:number; confidence:number; modeledMonthlyOpportunities:{low:number;high:number}; modeledAnnualRevenue:{low:number;high:number}; assumedDealValue:number; gaps:string[]; actions:string[]; disclaimer:string };

const pillars = [
  { label:"DISCOVER", title:"Find revenue opportunities", text:"Surface businesses with measurable gaps and rank them by revenue potential." },
  { label:"BUILD", title:"Create what the opportunity needs", text:"Generate offers and digital assets around the specific opportunity." },
  { label:"EXECUTE", title:"Move the opportunity toward revenue", text:"Coordinate leads, outreach, follow-up and outcome tracking from one mission." }
];

export default function Home() {
  const [running, setRunning] = useState(false);
  const [mission, setMission] = useState<Mission | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [busyAsset, setBusyAsset] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");\n  const [audits, setAudits] = useState<Record<string, RevenueAudit>>({});\n  const [busyAudit, setBusyAudit] = useState("");

  async function refresh() {
    const [m,o,a] = await Promise.all([
      fetch("/api/missions", {cache:"no-store"}),
      fetch("/api/opportunities", {cache:"no-store"}),
      fetch("/api/assets", {cache:"no-store"})
    ]);
    if (!m.ok || !o.ok || !a.ok) throw new Error("Workspace refresh failed");
    const [ms, os, as] = await Promise.all([m.json(), o.json(), a.json()]);
    setMission(ms[0] ?? null); setOpportunities(os); setAssets(as);
  }

  async function launch() {
    setRunning(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/missions", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ objective:"Find and pursue the highest-value next revenue opportunity." }) });
      if (!res.ok) throw new Error("Mission launch failed");
      const data = await res.json();
      setMission(data);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unknown error"); }
    finally { setRunning(false); }
  }

  async function runRevenueAudit(opportunityId: string) {\n    setBusyAudit(opportunityId); setError(""); setNotice("");\n    try {\n      const res = await fetch(`/api/revenue-audits?opportunityId=${encodeURIComponent(opportunityId)}`, {cache:"no-store"});\n      const data = await res.json().catch(() => ({}));\n      if (!res.ok) throw new Error(data.error || "Revenue audit failed");\n      setAudits(current => ({...current, [opportunityId]: data}));\n    } catch (e) { setError(e instanceof Error ? e.message : "Revenue audit failed"); }\n    finally { setBusyAudit(""); }\n  }\n\n  async function approveAndDeploy(asset: Asset) {
    if (asset.status === "published" && asset.deploymentUrl) return;
    setBusyAsset(asset.id); setError(""); setNotice("");
    try {
      const approval = await fetch("/api/approvals", {
        method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({assetId:asset.id})
      });
      const approved = await approval.json().catch(() => ({}));
      if (!approval.ok) throw new Error(approved.error || "Approval failed");

      const deployment = await fetch("/api/deployments", {
        method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({assetId:asset.id})
      });
      const deployed = await deployment.json().catch(() => ({}));
      if (!deployment.ok) throw new Error(deployed.error || "Deployment failed");

      setNotice("Website approved and published successfully.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deployment failed");
      await refresh().catch(() => {});
    } finally { setBusyAsset(""); }
  }

  useEffect(() => { refresh().catch(() => {}); }, []);

  const websiteAssets = useMemo(() => {
    const map = new Map<string, Asset>();
    for (const asset of assets) if (asset.type === "website") {
      const existing = map.get(asset.opportunityId);
      if (!existing || new Date(asset.createdAt).getTime() > new Date(existing.createdAt).getTime()) map.set(asset.opportunityId, asset);
    }
    return map;
  }, [assets]);

  const progress = mission?.progress ?? 0;

  return <main className="shell">
    <header className="nav">
      <div className="brand"><span className="brand-mark">✦</span> NORTHSTAR</div>
      <div className="status"><span /> AUTONOMOUS CORE ONLINE</div>
      <button className="ghost" onClick={launch} disabled={running}>Run mission →</button>
    </header>

    <section className="hero">
      <div className="eyebrow">AI REVENUE OPERATOR / LIVE SYSTEM</div>
      <h1>Your business gets an<br /><em>AI operator.</em> Not another dashboard.</h1>
      <p className="hero-copy">Northstar discovers opportunities, builds what is needed to pursue them, executes the revenue workflow, and records the outcome.</p>
      <div className="actions">
        <button className="primary" onClick={launch} disabled={running}>{running ? "EXECUTING MISSION…" : "LAUNCH AUTONOMOUS RUN"} <span>↗</span></button>
        <button className="secondary" onClick={() => document.querySelector(".opps")?.scrollIntoView({behavior:"smooth"})}>View opportunities</button>
      </div>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}
    </section>

    <section className="console">
      <div className="console-head"><div><span className="live-dot" /> LIVE AGENT CONSOLE</div><span>MISSION / {mission?.id ?? "READY"}</span></div>
      <div className="console-body">
        <div className="mission">
          <span className="label">CURRENT OBJECTIVE</span>
          <strong>{mission?.objective ?? "Find and pursue the highest-value next opportunity."}</strong>
          <div className="progress"><i style={{width: progress + "%"}} /></div>
          <small>{mission ? mission.currentStage.toUpperCase() + " · " + progress + "% · " + mission.status.toUpperCase() : "Awaiting mission launch"}</small>
        </div>
        <div className="events">
          {(mission ? [
            ["NOW","MISSION", mission.currentStage + " stage completed"],
            ["LIVE","DISCOVERY", opportunities.length + " opportunities persisted"],
            ["BUILD","ASSET", "Revenue recovery offers generated"],
            ["DATA","STORE", "Mission state written to local persistence"]
          ] : [
            ["READY","CORE","Mission engine initialized"],
            ["READY","STORE","Persistent state store available"],
            ["READY","DISCOVERY","Opportunity scoring engine available"],
            ["READY","EXECUTE","Launch a mission to begin"]
          ]).map(([time,type,message]) => <div className="event" key={time+type}><time>{time}</time><b>{type}</b><span>{message}</span></div>)}
        </div>
      </div>
    </section>

    <section className="opps">
      <div className="section-head"><div><span className="eyebrow">OPPORTUNITY INTELLIGENCE</span><h2>Highest-value signals</h2></div><span>{opportunities.length} STORED</span></div>
      <div className="opportunity-grid">
        {opportunities.slice(0,6).map(o => {
          const asset = websiteAssets.get(o.id);
          const liveUrl = o.deployedWebsiteUrl || asset?.deploymentUrl;
          return <article className="opportunity" key={o.id}>
            <div className="score">{o.score}</div>
            <div className="opportunity-main">
              <strong>{o.businessName}</strong><span>{o.category} · {o.location}</span>
              <div className="audit-workspace">\n                <div>\n                  <small className="workspace-label">REVENUE AUDIT</small>\n                  <b>{audits[o.id] ? `MODELED ${Math.round(audits[o.id].modeledAnnualRevenue.low / 1000)}K–${Math.round(audits[o.id].modeledAnnualRevenue.high / 1000)}K / YEAR` : "NOT YET MODELED"}</b>\n                </div>\n                <button className="audit-button" onClick={() => runRevenueAudit(o.id)} disabled={busyAudit === o.id}>\n                  {busyAudit === o.id ? "ANALYZING…" : audits[o.id] ? "REFRESH AUDIT" : "RUN REVENUE AUDIT"}\n                </button>\n              </div>\n              {audits[o.id] && <div className="audit-result"><span>{audits[o.id].confidence}% confidence</span><span>{audits[o.id].modeledMonthlyOpportunities.low}–{audits[o.id].modeledMonthlyOpportunities.high} modeled opportunities/mo</span><span>Assumed deal value ${audits[o.id].assumedDealValue.toLocaleString()}</span></div>}\n              <div className="website-workspace">
                <div>
                  <small className="workspace-label">WEBSITE WORKSPACE</small>
                  <b>{liveUrl ? "LIVE ON VERCEL" : asset ? "WEBSITE ASSET READY" : "NO WEBSITE ASSET"}</b>
                </div>
                {liveUrl ? (
                  <a className="live-link" href={liveUrl} target="_blank" rel="noreferrer">Open live site ↗</a>
                ) : asset ? (
                  <button className="publish" onClick={() => approveAndDeploy(asset)} disabled={busyAsset === asset.id}>
                    {busyAsset === asset.id ? "PUBLISHING…" : asset.status === "ready" ? "PUBLISH TO VERCEL" : "APPROVE & PUBLISH"}
                  </button>
                ) : (
                  <span className="workspace-muted">Generate a website asset to continue</span>
                )}
              </div>
            </div>
            <small className="opp-status">{o.status.toUpperCase()}</small>
          </article>;
        })}
        {!opportunities.length && <div className="empty">No opportunities yet. Launch an autonomous mission.</div>}
      </div>
    </section>

    <section className="pillars">{pillars.map(p => <article key={p.label}><span>{p.label}</span><h2>{p.title}</h2><p>{p.text}</p></article>)}</section>
    <footer><span>NORTHSTAR / AUTONOMOUS BUSINESS EXECUTION</span><span>PERSISTENCE · MISSIONS · OPPORTUNITIES · REVENUE</span></footer>
  </main>;
}
