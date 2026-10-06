import postgres from "postgres";
import type { NorthstarDB } from "./types";

const connectionString = process.env.DATABASE_URL;
const sql = connectionString ? postgres(connectionString, { max: 1, prepare: false }) : null;
const emptyDB: NorthstarDB = { missions:[], opportunities:[], leads:[], assets:[], revenue:[], leadResponses:[], appointments:[], deals:[], attributions:[], executions:[], audit:[] };

async function ensureDB() {
  if (!sql) return;
  await sql`CREATE TABLE IF NOT EXISTS northstar_state (
    id INTEGER PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`INSERT INTO northstar_state (id,data) VALUES (1, ${sql.json(emptyDB)}) ON CONFLICT (id) DO NOTHING`;
}

function normalize(db: NorthstarDB): NorthstarDB {
  db.missions ??=[]; db.opportunities ??=[]; db.leads ??=[]; db.assets ??=[]; db.revenue ??=[];
  db.leadResponses ??=[]; db.appointments ??=[]; db.deals ??=[]; db.attributions ??=[]; db.executions ??=[]; db.audit ??=[];
  return db;
}

export async function readDB(): Promise<NorthstarDB> {
  if (!sql) {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    const file = path.join(process.cwd(), ".northstar", "data.json");
    await fs.mkdir(path.dirname(file), {recursive:true});
    try { return normalize(JSON.parse(await fs.readFile(file,"utf8")) as NorthstarDB); }
    catch { await fs.writeFile(file, JSON.stringify(emptyDB,null,2),"utf8"); return structuredClone(emptyDB); }
  }
  await ensureDB();
  const rows = await sql`SELECT data FROM northstar_state WHERE id=1`;
  return normalize((rows[0]?.data as NorthstarDB) || structuredClone(emptyDB));
}

export async function writeDB(db: NorthstarDB) {
  if (!sql) {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    const file = path.join(process.cwd(), ".northstar", "data.json");
    await fs.mkdir(path.dirname(file), {recursive:true});
    await fs.writeFile(file, JSON.stringify(db,null,2),"utf8");
    return;
  }
  await ensureDB();
  await sql`UPDATE northstar_state SET data=${sql.json(db)}, updated_at=NOW() WHERE id=1`;
}

export async function updateDB<T>(fn:(db:NorthstarDB)=>T|Promise<T>):Promise<T> {
  if (!sql) { const db=await readDB(); const result=await fn(db); await writeDB(db); return result; }
  await ensureDB();
  return sql.begin(async tx => {
    const rows = await tx`SELECT data FROM northstar_state WHERE id=1 FOR UPDATE`;
    const db = (rows[0]?.data as NorthstarDB) || structuredClone(emptyDB);
    const result = await fn(db);
    await tx`UPDATE northstar_state SET data=${tx.json(db)}, updated_at=NOW() WHERE id=1`;
    return result;
  }) as Promise<T>;
}
