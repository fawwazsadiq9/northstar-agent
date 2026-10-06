"use client";

import { useEffect, useState } from "react";

type Mission = { id:string; objective:string; status:string; progress:number; currentStage:string; updatedAt:string };
type Opportunity = { id:string; businessName:string; category:string; location:string; score:number; status:string };

const pillars = [
  { label:"DISCOVER", title:"Find revenue opportunities", text:"Surface businesses with measurable gaps and rank them by revenue potential." },
  { label:"BUILD", title:"Create what the opportunity needs", text:"Generate offers and digital assets around the specific opportunity." },
  { label:"EXECUTE", title:"Move the opportunity toward revenue", text:"Coordinate leads, outreach, follow-up and outcome tracking from one mission." }
];

export default function Home() {
  const [running, setRunning] = useState(false);
  const [mission, setMission] = useState<Mission | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [error, setError] = useState("");

  async function launch() {
    setRunning(true); setError("");
    try {
      const res = await fetch("/api/missions", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ objective:"Find and pursue the highest-value next revenue opportunity." }) });
      if (!res.ok) throw new Error("Mission launch failed");
      const data = await res.json();
      setMission(data);
      const opps = await fetch("/api/opportunities").then(r => r.json());
      setOpportunities(opps);
    } catch (e) { setError(e instanceof Error ? e.message : "Unknown error"); }
    finally { setRunning(false); }
  }

  useEffect(() => {
    Promise.all([fetch("/api/missions"), fetch("/api/opportunities")]).then(async ([m,o]) => {
      const ms = await m.json(); const os = await o.json();
      setMission(ms[0] ?? null); setOpportunities(os);
    }).catch(() => {});
  }, []);

  const progress = mission?.progress ?? 0;

  return <main className="shell">
    <header className="nav">
      <div className="brand"><span className="brand-mark">✦</span> NORTHSTAR</div>
      <div className="status"><span /> AUTONOMOUS CORE ONLINE</div>
      <button className="ghost" onClick={launch}>Run mission →</button>
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
        {opportunities.slice(0,6).map(o => <article className="opportunity" key={o.id}><div className="score">{o.score}</div><div><strong>{o.businessName}</strong><span>{o.category} · {o.location}</span></div><small>{o.status.toUpperCase()}</small></article>)}
        {!opportunities.length && <div className="empty">No opportunities yet. Launch an autonomous mission.</div>}
      </div>
    </section>

    <section className="pillars">{pillars.map(p => <article key={p.label}><span>{p.label}</span><h2>{p.title}</h2><p>{p.text}</p></article>)}</section>
    <footer><span>NORTHSTAR / AUTONOMOUS BUSINESS EXECUTION</span><span>PERSISTENCE · MISSIONS · OPPORTUNITIES · REVENUE</span></footer>
  </main>;
}