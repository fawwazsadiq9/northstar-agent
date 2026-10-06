import { NextResponse } from "next/server";
import { readDB } from "../../../lib/store";
export async function GET(){return NextResponse.json((await readDB()).deals)}
