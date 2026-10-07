"use client";

import { useEffect, useMemo, useState } from "react";

type Tab="command"|"opportunities"|"websites"|"leads"|"revenue"|"intelligence"|"activity";
type Mission={id:string;objective:string;status:string;progress:number;currentStage:string;updatedAt:string};
type Opportunity={id:string;businessName:string;category:string;location:string;score:number;signals:string[];status:string;contactEmail?:string;deployedWebsiteUrl?:string};
type Asset={id:string;opportunityId:string;type:string;title:string;content:string;status:string;deploymentUrl?:string;createdAt:string};
type Lead={id:string;opportunityId:string;name:string;email?:string;phone?:string;message?:string;status:string};
type Revenue={id:string;opportunityId?:string;type:string;amount:number;currency:string;note:string;createdAt:string};
type Deal={id:string;opportunityId:string;leadId?:string;value:number;currency:string;status:string};
type Response={id:string;leadId:string;content:string;channel:string;status:string;kind?:string;createdAt:string};

const tabs:[Tab,string,string][]=[
  ["command","Command","01"],["opportunities","Opportunities","02"],["websites","Asset Forge","03"],
  ["leads","Revenue Flow","04"],["revenue","Revenue","05"],["intelligence","Intelligence","06"],["activity","Activity","07"]
];

function Icon({name}:{name:string}) {
  const paths:Record<string,string>={command:"M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4",target:"M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1",layers:"M3 7l9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4",users:"M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-6a3 3 0 0 1 0 6m2 10v-2a4 4 0 0 0-3-3",money:"M3 7h18v14H3zM7 3h10v4H7zM12 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",brain:"M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3 3 3 0 0 0 3 3v1a3 3 0 0 0 3 3h1V3H9Zm6 0a3 3 0 0 1 3 3v1a3 3 0 0 1 3 3 3 3 0 0 1-3 3v1a3 3 0 0 1-3 3h-1V3h1Z",activity:"M3 12h4l2-7 4 14 2-7h6"};
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]||paths.command}/></svg>;
}

function formatMoney(n:number){return "$"+Math.round(n||0).toLocaleString();}
function pct(n:number){return Math.round((n||0)*100)+"%";}

export default function Home(){
  const [tab,setTab]=useState<Tab>("command");
  const [mission,setMission]=useState<Mission|null>(null),[missions,setMissions]=useState<Mission[]>([]);
  const [opportunities,setOpportunities]=useState<Opportunity[]>([]),[assets,setAssets]=useState<Asset[]>([]);
  const [leads,setLeads]=useState<Lead[]>([]),[revenue,setRevenue]=useState<Revenue[]>([]),[deals,setDeals]=useState<Deal[]>([]),[responses,setResponses]=useState<Response[]>([]);
  const [learning,setLearning]=useState<any>(null),[economics,setEconomics]=useState<any>(null),[economicLearning,setEconomicLearning]=useState<any>(null);
  const [portfolio,setPortfolio]=useState<any>(null),[capital,setCapital]=useState<any>(null),[decision,setDecision]=useState<any>(null),[replan,setReplan]=useState<any>(null);
  const [busy,setBusy]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [auditData,setAuditData]=useState<Record<string,any>>({});

  async function refresh(){
    const missionId=mission?.id||missions[0]?.id||"";
    const urls=["/api/missions","/api/opportunities","/api/assets","/api/leads","/api/revenue","/api/deals","/api/execution","/api/revenue-learning","/api/economics","/api/economic-learning","/api/portfolio"];
    const core=await Promise.all(urls.map(x=>fetch(x,{cache:"no-store"})));
    if(!core.every(x=>x.ok))throw Error("Workspace refresh failed");
    const [m,o,a,l,v,d,rr,rl,ec,el,pf]=await Promise.all(core.map(x=>x.json()));
    const active=m.find((x:Mission)=>x.id===mission?.id)||m[0]||null;
    const id=active?.id||missionId;
    const extras=await Promise.all([
      id?fetch("/api/capital?missionId="+encodeURIComponent(id),{cache:"no-store"}):Promise.resolve(null),
      id?fetch("/api/decision-engine?missionId="+encodeURIComponent(id),{cache:"no-store"}):Promise.resolve(null),
      id?fetch("/api/replan?missionId="+encodeURIComponent(id),{cache:"no-store"}):Promise.resolve(null)
    ]);
    const [cp,dc,rp]=await Promise.all(extras.map(x=>x?x.json():null));
    setMissions(m);setMission(active);setOpportunities(o);setAssets(a);setLeads(l);setRevenue(v);setDeals(d);setResponses(rr);
    setLearning(rl);setEconomics(ec);setEconomicLearning(el);setPortfolio(pf);setCapital(cp);setDecision(dc);setReplan(rp);
  }

  async function launch(){
    setBusy("mission");setError("");setNotice("");
    try{
      const r=await fetch("/api/missions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({objective:"Find and pursue the highest-value next revenue opportunity."})});
      const m=await r.json();if(!r.ok)throw Error(m.error);
      setMission(m);setNotice("Autonomous mission initialized.");
      fetch("/api/missions/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({missionId:m.id})}).catch(()=>{});
      for(let i=0;i<12;i++){await new Promise(x=>setTimeout(x,1000));await refresh().catch(()=>{});}
    }catch(e){setError(e instanceof Error?e.message:"Mission failed")}finally{setBusy("")}
  }

  async function post(url:string,body:any,key:string,msg:string){
    setBusy(key);setError("");try{
      const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Action failed");
      setNotice(msg);await refresh();
    }catch(e){setError(e instanceof Error?e.message:"Action failed")}finally{setBusy("")}
  }
  async function build(o:string,a:"website"|"offer"|"outreach"){await post("/api/operator",{opportunityId:o,action:a},o+a,a==="website"?"Website built.":a==="offer"?"Offer built.":"Outreach draft built.")}
  async function audit(o:string){setBusy(o+"audit");try{const r=await fetch("/api/revenue-audits?opportunityId="+encodeURIComponent(o));const d=await r.json();if(!r.ok)throw Error(d.error);setNotice("Revenue audit complete.");setAuditData(x=>({...x,[o]:d}))}catch(e){setError(e instanceof Error?e.message:"Audit failed")}finally{setBusy("")}}
  async function publish(a:Asset){setBusy(a.id);try{let r=await fetch("/api/approvals",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({assetId:a.id,action:"publish"})});let d=await r.json();if(!r.ok)throw Error(d.error);r=await fetch("/api/deployments",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({assetId:a.id})});d=await r.json();if(!r.ok)throw Error(d.error);setNotice("Asset deployed.");await refresh()}catch(e){setError(e instanceof Error?e.message:"Publish failed")}finally{setBusy("")}}
  async function respond(id:string){await post("/api/execution",{action:"respond",leadId:id},id+"r","AI response drafted.")}
  async function approveResponse(id:string){await post("/api/execution",{action:"approve_response",responseId:id},id+"a","Response approved.")}
  async function sendResponse(id:string){await post("/api/execution",{action:"send_response",responseId:id},id+"s","Response sent. Follow-up scheduled.")}
  async function meeting(l:Lead){await post("/api/execution",{action:"appointment",leadId:l.id,startsAt:new Date(Date.now()+86400000).toISOString()},l.id+"m","Appointment recorded.")}
  async function deal(l:Lead){const v=prompt("Deal value (USD)","2000");if(v)await post("/api/execution",{action:"deal",leadId:l.id,opportunityId:l.opportunityId,value:Number(v)},l.id+"d","Deal created.")}
  async function won(d:Deal){await post("/api/execution",{action:"close_deal",dealId:d.id,status:"won"},d.id+"w","Deal closed-won and attributed.")}
  async function replanNow(){if(mission)await post("/api/replan",{missionId:mission.id,trigger:"manual"},"replan","Economic plan recalculated.")}

  useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);

  const websites=assets.filter(a=>a.type==="website");
  const wonRevenue=revenue.filter(x=>x.type==="won"||x.type==="payment").reduce((n,x)=>n+x.amount,0);
  const pipeline=revenue.filter(x=>x.type==="pipeline").reduce((n,x)=>n+x.amount,0);
  const selected=decision?.selected;
  const allocations=capital?.allocations||portfolio?.portfolio?.allocations||[];
  const systemStage=mission?.currentStage||"STANDBY";
  const activity=useMemo(()=>[
    ...(replan?.events||[]).slice(0,3).map((e:any)=>({label:"REPLAN",text:e.allocationsChanged?"Capital allocation changed":"Plan reconciled",meta:new Date(e.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})})),
    ...opportunities.slice(0,3).map(o=>({label:"SIGNAL",text:o.businessName,meta:o.category})),
    ...leads.slice(0,2).map(l=>({label:"LEAD",text:l.name,meta:l.status}))
  ].slice(0,6),[replan,opportunities,leads]);

  return <main className="northstar-app">
    <aside className="sidebar">
      <div className="brand-lockup"><div className="brand-orbit"><span>✦</span></div><div><b>NORTHSTAR</b><small>ECONOMIC INTELLIGENCE</small></div></div>
      <div className="sidebar-status"><i/> SYSTEM ONLINE <span>v2.0</span></div>
      <nav className="side-nav">{tabs.map(([id,label,num])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><Icon name={id==="command"?"command":id==="opportunities"?"target":id==="websites"?"layers":id==="leads"?"users":id==="revenue"?"money":id==="intelligence"?"brain":"activity"}/><span>{label}</span><em>{num}</em></button>)}</nav>
      <div className="sidebar-bottom"><div className="mini-core"><span>✦</span><div><b>AUTONOMOUS CORE</b><small>Learning continuously</small></div></div><button className="settings">SYSTEM SETTINGS <span>↗</span></button></div>
    </aside>

    <section className="main-stage">
      <header className="topbar">
        <div><span className="top-eyebrow">NORTHSTAR / {tab.toUpperCase()}</span><strong>{systemStage.toUpperCase()}</strong></div>
        <div className="telemetry"><span><i/> CORE ONLINE</span><span>CAPACITY {capital?.capacityUsed||0}/{capital?.capacity||0}</span><span>UTC {new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span><button className="run-button" onClick={launch} disabled={!!busy}>{busy==="mission"?"RUNNING":"RUN AUTONOMOUS CYCLE"} <b>⌘</b></button></div>
      </header>

      {error&&<div className="system-alert danger">{error}</div>}{notice&&<div className="system-alert">{notice}<button onClick={()=>setNotice("")}>×</button></div>}

      {tab==="command"&&<section className="command-view">
        <div className="command-hero">
          <div><span className="top-eyebrow">AUTONOMOUS ECONOMIC COMMAND CENTER</span><h1>Northstar is <span>thinking ahead.</span></h1><p>One system that discovers opportunities, allocates scarce execution capacity, acts, measures revenue, and continuously replans.</p></div>
          <div className="mission-state"><span className="pulse"/><small>ACTIVE MISSION</small><b>{mission?.status?.toUpperCase()||"READY"}</b><label>{mission?.currentStage||"Awaiting autonomous execution"}</label><div className="thin-progress"><i style={{width:(mission?.progress||0)+"%"}}/></div></div>
        </div>

        <div className="core-layout">
          <div className="intelligence-core">
            <div className="core-grid"/>
            <div className="orbit orbit-one"><span/><i/></div><div className="orbit orbit-two"><span/><i/></div><div className="orbit orbit-three"><span/><i/></div>
            <div className="core-glow"/><div className="core-symbol">✦<small>NS</small></div>
            <div className="core-caption"><span>DECISION ENGINE</span><b>{selected?.action?.toUpperCase()||"STANDBY"}</b></div>
          </div>
          <div className="decision-panel">
            <div className="panel-kicker"><span className="live-dot"/> NEXT BEST ACTION <span>LIVE</span></div>
            <h2>{selected?.action?selected.action.replace("_"," "):"Awaiting signal"}</h2>
            <p>{selected?.reason||"Launch an autonomous mission and Northstar will evaluate the current economic state before choosing its next action."}</p>
            <div className="decision-meta"><div><small>CONFIDENCE</small><b>{selected?Math.round(selected.score)+"%":"—"}</b></div><div><small>EXPECTED VALUE</small><b>{formatMoney(allocations[0]?.expectedValue||0)}</b></div><div><small>PERIOD</small><b>{allocations[0]?.period||"—"}</b></div></div>
            <button className="decision-button" onClick={()=>mission&&post("/api/decision-engine",{missionId:mission.id},"decision","Decision executed.")} disabled={!mission||!!busy}>EXECUTE DECISION <span>→</span></button>
          </div>
        </div>

        <div className="metric-strip">
          <div><small>ATTRIBUTED REVENUE</small><strong>{formatMoney(wonRevenue)}</strong><span>verified closed-won flow</span></div>
          <div><small>PIPELINE</small><strong>{formatMoney(pipeline)}</strong><span>{deals.filter(d=>d.status!=="won").length} open deals</span></div>
          <div><small>OPPORTUNITIES</small><strong>{opportunities.length}</strong><span>economic candidates</span></div>
          <div><small>CAPITAL ALLOCATED</small><strong>{formatMoney(capital?.allocated||0)}</strong><span>{capital?.capacityUsed||0}/{capital?.capacity||0} capacity</span></div>
          <div><small>LEARNING EVIDENCE</small><strong>{economicLearning?.observations?.length||0}</strong><span>outcomes recalibrating model</span></div>
        </div>

        <div className="lower-grid">
          <section className="panel">
            <div className="panel-head"><div><span className="top-eyebrow">CAPITAL CONTROL</span><h3>Where Northstar is spending its attention</h3></div><button onClick={replanNow}>REPLAN ↻</button></div>
            <div className="allocation-list">{allocations.slice(0,5).map((a:any,i:number)=><div className="allocation" key={(a.opportunityId||i)+i}><div className="allocation-index">0{i+1}</div><div className="allocation-main"><b>{a.businessName||"Opportunity"}</b><span>{a.strategyName||"Adaptive strategy"} · {a.allocation||"exploit"}</span><div className="allocation-bar"><i style={{width:Math.min(100,Math.max(8,(a.score||0)))+"%"}}/></div></div><div className="allocation-value"><b>{formatMoney(a.expectedValue||0)}</b><span>{a.period||"now"}</span></div></div>)}{!allocations.length&&<div className="empty-state">No active allocation. Run a mission to initialize the economic planner.</div>}</div>
          </section>
          <section className="panel activity-panel">
            <div className="panel-head"><div><span className="top-eyebrow">LIVE SIGNALS</span><h3>System activity</h3></div><span className="live-label"><i/> STREAMING</span></div>
            <div className="activity-feed">{activity.map((a,i)=><div className="feed-item" key={i}><div className="feed-dot"/><div><b>{a.label}</b><span>{a.text}</span></div><small>{a.meta}</small></div>)}{!activity.length&&<div className="empty-state">Awaiting system signals.</div>}</div>
          </section>
        </div>
      </section>}

      {tab==="opportunities"&&<Workspace title="Opportunity Intelligence" kicker="SIGNAL ACQUISITION" action={<button className="outline-button" onClick={launch}>RUN NEW SCAN ↗</button>}><div className="opportunity-grid futuristic">{opportunities.map(o=><article className="opportunity-card" key={o.id}><div className="opportunity-score"><span>SCORE</span><b>{o.score}</b></div><div className="opportunity-info"><div className="card-tag">{o.category} / {o.location}</div><h3>{o.businessName}</h3><div className="signal-row">{(o.signals||[]).slice(0,4).map(s=><span key={s}>{s}</span>)}</div>{economics?.ranked?.filter((x:any)=>x.opportunityId===o.id).map((x:any)=><div className="economic-line" key={x.opportunityId}><b>{x.recommendation.toUpperCase()}</b><span>EV {formatMoney(x.expectedValue)} · {formatMoney(x.expectedCashVelocity)}/DAY · {pct(x.winProbability)}</span></div>)}{auditData[o.id]&&<div className="economic-line"><b>AUDIT</b><span>{formatMoney(auditData[o.id].modeledAnnualRevenue.low)}–{formatMoney(auditData[o.id].modeledAnnualRevenue.high)} modeled annual upside</span></div>}<div className="action-row"><button onClick={()=>audit(o.id)}>AUDIT</button><button onClick={()=>build(o.id,"website")}>BUILD SITE</button><button onClick={()=>build(o.id,"offer")}>BUILD OFFER</button>{o.contactEmail&&<button onClick={()=>build(o.id,"outreach")}>OUTREACH</button>}</div></div><small className="opp-status">{o.status.toUpperCase()}</small></article>)}{!opportunities.length&&<div className="empty-state wide">Run a mission to discover real businesses.</div>}</div></Workspace>}

      {tab==="websites"&&<Workspace title="Asset Forge" kicker="AUTONOMOUS PRODUCTION"><div className="asset-grid">{websites.map(a=><article className="asset-card" key={a.id}><div className="card-tag">{opportunities.find(o=>o.id===a.opportunityId)?.businessName||"Opportunity"}</div><h3>{a.title}</h3><span className="status-chip">{a.status.toUpperCase()}</span>{a.deploymentUrl?<a className="outline-button" href={a.deploymentUrl} target="_blank">OPEN LIVE SITE ↗</a>:<button className="outline-button" onClick={()=>publish(a)}>{busy===a.id?"DEPLOYING…":"APPROVE & DEPLOY"}</button>}</article>)}{!websites.length&&<div className="empty-state wide">No assets yet. Select an opportunity and deploy what it needs.</div>}</div></Workspace>}

      {tab==="leads"&&<Workspace title="Revenue Flow" kicker="LEAD → RESPONSE → DEAL"><div className="lead-list futuristic">{leads.map(l=><article className="lead-card" key={l.id}><div className="lead-top"><div><span className="card-tag">INBOUND SIGNAL</span><h3>{l.name}</h3><span>{l.email||l.phone||"No contact channel"}</span><small>{opportunities.find(o=>o.id===l.opportunityId)?.businessName||"Opportunity"}</small></div><b>{l.status.toUpperCase()}</b></div><p>{l.message||"No message supplied."}</p><div className="action-row"><button onClick={()=>respond(l.id)}>AI RESPONSE</button><button onClick={()=>meeting(l)}>RECORD MEETING</button><button onClick={()=>deal(l)}>CREATE DEAL</button>{deals.filter(d=>d.leadId===l.id).map(d=><button key={d.id} className="accent-button" onClick={()=>won(d)} disabled={d.status==="won"}>{d.status==="won"?"WON":"CLOSE WON"}</button>)}</div>{responses.filter(r=>r.leadId===l.id).slice(0,3).map(r=><div className="response-card" key={r.id}><small>{(r.kind||"initial").replace("_"," ").toUpperCase()} · {r.status.toUpperCase()}</small><p>{r.content}</p><div className="action-row">{r.status==="draft"&&<button onClick={()=>approveResponse(r.id)}>APPROVE</button>}{r.status==="approved"&&<button className="accent-button" onClick={()=>sendResponse(r.id)}>SEND EMAIL</button>}</div></div>)}</article>)}{!leads.length&&<div className="empty-state wide">No live leads yet. Deploy a site and let the revenue loop begin.</div>}</div></Workspace>}

      {tab==="revenue"&&<Workspace title="Revenue" kicker="OUTCOME TELEMETRY"><div className="metric-grid-large"><Metric label="WON REVENUE" value={formatMoney(wonRevenue)} sub="Attributed closed-won"/><Metric label="PIPELINE" value={formatMoney(pipeline)} sub="Open revenue potential"/><Metric label="LEADS" value={String(leads.length)} sub="Captured demand"/><Metric label="WON DEALS" value={String(deals.filter(d=>d.status==="won").length)} sub="Closed outcomes"/></div><div className="revenue-list">{revenue.map(r=><article key={r.id}><span className="card-tag">{r.type.toUpperCase()}</span><strong>{r.currency} {r.amount.toLocaleString()}</strong><span>{r.note}</span><small>{new Date(r.createdAt).toLocaleDateString()}</small></article>)}{!revenue.length&&<div className="empty-state wide">Revenue telemetry will appear as deals move through the system.</div>}</div></Workspace>}

      {tab==="intelligence"&&<Workspace title="Intelligence" kicker="SELF-IMPROVING ECONOMIC BRAIN" action={<button className="outline-button" onClick={replanNow}>RECALIBRATE ↻</button>}><p className="workspace-intro">Northstar links strategy experiments, revenue outcomes, economic evidence and regret into an adaptive decision system. Evidence is experimental—not a guarantee of causality.</p><div className="intelligence-grid"><Metric label="ATTRIBUTED REVENUE" value={formatMoney(learning?.totalRevenue||0)} sub={(learning?.attributionCount||0)+" experiment outcomes"}/><Metric label="PLAYBOOKS" value={String(learning?.playbooks?.length||0)} sub="Contextual winners"/><Metric label="ECONOMIC EVIDENCE" value={String(economicLearning?.observations?.length||0)} sub="Observed outcomes"/><Metric label="CREDIBLE EFFECTS" value={String(portfolio?.causality?.estimates?.filter((x:any)=>x.credible).length||0)} sub="Evidence threshold met"/></div><div className="insight-grid"><section className="panel"><div className="panel-head"><div><span className="top-eyebrow">PLAYBOOKS</span><h3>What is working</h3></div></div>{(learning?.playbooks||[]).slice(0,6).map((p:any)=><div className="insight-row" key={p.id}><div><b>{p.context.industry}</b><span>{p.context.geography} · {p.context.channel}</span></div><strong>{p.recommendedVariantName}</strong><em>{Math.round(p.confidence*100)}% CONF</em></div>)}{!learning?.playbooks?.length&&<div className="empty-state">No validated playbooks yet.</div>}</section><section className="panel"><div className="panel-head"><div><span className="top-eyebrow">CAPITAL PLAN</span><h3>Expected economic return</h3></div></div>{allocations.slice(0,6).map((a:any)=><div className="insight-row" key={a.opportunityId}><div><b>{a.businessName}</b><span>{a.strategyName||"Adaptive"} · {a.allocation||"exploit"}</span></div><strong>{formatMoney(a.expectedValue)}</strong><em>{(a.marginalROI||0).toFixed(1)}x ROI</em></div>)}</section></div><div className="lab-links"><a href="/api/intelligence/orange">EXPORT ORANGE DATASET ↗</a><a href="/workflows/northstar-opportunity-intelligence.ows" target="_blank">OPEN MODEL WORKFLOW ↗</a><span>ATTRIBUTE → WEIGHT → PROVE → EVOLVE</span></div></Workspace>}

      {tab==="activity"&&<Workspace title="Activity" kicker="AUTONOMOUS EXECUTION LOG"><div className="mission-list">{missions.map(m=><article key={m.id}><span className="card-tag">{m.status.toUpperCase()}</span><h3>{m.objective}</h3><p>{m.currentStage} · {m.progress}%</p><small>{new Date(m.updatedAt).toLocaleString()}</small></article>)}{!missions.length&&<div className="empty-state wide">No mission history.</div>}</div></Workspace>}

      <footer><span>NORTHSTAR / AUTONOMOUS ECONOMIC INTELLIGENCE</span><span>DISCOVER · DECIDE · EXECUTE · LEARN</span></footer>
    </section>
  </main>
}

function Metric({label,value,sub}:{label:string;value:string;sub:string}){return <div className="metric-box"><small>{label}</small><strong>{value}</strong><span>{sub}</span></div>}

function Workspace({title,kicker,action,children}:{title:string;kicker:string;action?:React.ReactNode;children:React.ReactNode}){
 return <section className="workspace-page"><div className="workspace-header"><div><span className="top-eyebrow">{kicker}</span><h1>{title}</h1></div>{action}</div>{children}</section>
}
