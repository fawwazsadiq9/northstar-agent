 "use client";

import { useState } from "react";

const pillars = [
  { label: "DISCOVER", title: "Find revenue opportunities", text: "Northstar scans markets, businesses and signals to identify opportunities worth pursuing." },
  { label: "BUILD", title: "Create what the opportunity needs", text: "Websites, offers, outreach assets and response systems are produced by the operator." },
  { label: "EXECUTE", title: "Move the opportunity toward revenue", text: "Northstar coordinates outreach, lead response, follow-up and outcome tracking." }
];

const events = [
  ["04:21:08", "DISCOVERY", "12 qualified opportunities identified"],
  ["04:21:14", "RESEARCH", "Dental services cluster scored 91/100"],
  ["04:21:19", "BUILD", "Revenue recovery offer generated"],
  ["04:21:27", "OUTREACH", "Personalized sequence prepared"],
];

export default function Home() {
  const [running, setRunning] = useState(false);

  return (
    <main className="shell">
      <header className="nav">
        <div className="brand"><span className="brand-mark">✦</span> NORTHSTAR</div>
        <div className="status"><span /> AUTONOMOUS CORE ONLINE</div>
        <button className="ghost">Open Console →</button>
      </header>

      <section className="hero">
        <div className="eyebrow">AI REVENUE OPERATOR / 001</div>
        <h1>Your business gets an<br /><em>AI operator.</em> Not another dashboard.</h1>
        <p className="hero-copy">Northstar discovers opportunities, builds what is needed to pursue them, executes the revenue workflow, and learns from the outcome.</p>
        <div className="actions">
          <button className="primary" onClick={() => setRunning(true)}>{running ? "AUTONOMOUS RUN ACTIVE" : "LAUNCH AUTONOMOUS RUN"} <span>↗</span></button>
          <button className="secondary">View architecture</button>
        </div>
      </section>

      <section className="console">
        <div className="console-head">
          <div><span className="live-dot" /> LIVE AGENT CONSOLE</div>
          <span>MISSION / REVENUE-001</span>
        </div>
        <div className="console-body">
          <div className="mission">
            <span className="label">CURRENT OBJECTIVE</span>
            <strong>{running ? "Executing revenue mission…" : "Find and pursue the highest-value next opportunity."}</strong>
            <div className="progress"><i style={{ width: running ? "68%" : "18%" }} /></div>
            <small>{running ? "4 / 6 autonomous stages active" : "Awaiting mission launch"}</small>
          </div>
          <div className="events">
            {events.map(([time, type, message]) => <div className="event" key={time}><time>{time}</time><b>{type}</b><span>{message}</span></div>)}
          </div>
        </div>
      </section>

      <section className="pillars">
        {pillars.map((p) => <article key={p.label}><span>{p.label}</span><h2>{p.title}</h2><p>{p.text}</p></article>)}
      </section>

      <footer><span>NORTHSTAR / AUTONOMOUS BUSINESS EXECUTION</span><span>BUILDING TOWARD THE AUTONOMOUS COMPANY</span></footer>
    </main>
  );
}