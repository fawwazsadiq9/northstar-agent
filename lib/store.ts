import { promises as fs } from "node:fs";
import path from "node:path";
import type { NorthstarDB } from "./types";

const dataDir = path.join(process.cwd(), ".northstar");
const dataFile = path.join(dataDir, "data.json");

const emptyDB: NorthstarDB = { missions: [], opportunities: [], leads: [], assets: [], revenue: [] };

async function ensureDB() {
  await fs.mkdir(dataDir, { recursive: true });
  try { await fs.access(dataFile); }
  catch { await fs.writeFile(dataFile, JSON.stringify(emptyDB, null, 2), "utf8"); }
}

export async function readDB(): Promise<NorthstarDB> {
  await ensureDB();
  const raw = await fs.readFile(dataFile, "utf8");
  return JSON.parse(raw) as NorthstarDB;
}

export async function writeDB(db: NorthstarDB) {
  await ensureDB();
  const temp = dataFile + ".tmp";
  await fs.writeFile(temp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(temp, dataFile);
}

export async function updateDB<T>(fn: (db: NorthstarDB) => T | Promise<T>): Promise<T> {
  const db = await readDB();
  const result = await fn(db);
  await writeDB(db);
  return result;
}