import type { Opportunity } from "./types";
import { id } from "./id";

type DiscoveryInput = { location: string; category?: string; limit?: number };
type Place = { lat: string; lon: string; display_name: string };
type Element = { id: number; type: string; tags?: Record<string,string> };

const NOMINATIM = process.env.NORTHSTAR_NOMINATIM_URL || "https://nominatim.openstreetmap.org/search";
const OVERPASS = process.env.NORTHSTAR_OVERPASS_URL || "https://overpass-api.de/api/interpreter";

function tagFilter(category?: string) {
  const c = (category || "").toLowerCase();
  if (c.includes("dental")) return '["amenity"="dentist"]';
  if (c.includes("hvac")) return '["shop"="hvac"]';
  if (c.includes("roof")) return '["craft"="roofer"]';
  if (c.includes("restaurant")) return '["amenity"="restaurant"]';
  if (c.includes("salon")) return '["shop"="hairdresser"]';
  if (c.includes("auto")) return '["shop"="car_repair"]';
  return '["name"]';
}

async function geocode(location: string): Promise<Place> {
  const url = new URL(NOMINATIM);
  url.searchParams.set("q", location);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  const r = await fetch(url, { headers: { "User-Agent": "Northstar/1.0 business-discovery" }, cache: "no-store" });
  if (!r.ok) throw new Error("Geocoding provider failed");
  const places = await r.json() as Place[];
  if (!places[0]) throw new Error("Location not found");
  return places[0];
}

function score(tags: Record<string,string>) {
  let value = 55;
  const signals = ["Public business listing discovered"];
  if (!tags.website && !tags["contact:website"]) {
    value += 25;
    signals.push("No website listed in OpenStreetMap");
  } else {
    signals.push("Website listed in public business data");
  }
  if (tags.phone || tags["contact:phone"]) { value += 5; signals.push("Public phone number available"); }
  if (tags["opening_hours"]) { value += 5; signals.push("Public opening hours available"); }
  if (tags["contact:" + "email"]) { value += 5; signals.push("Public contact email available"); }
  return { score: Math.min(99, value), signals };
}

export async function discoverOpportunities(input: DiscoveryInput): Promise<Opportunity[]> {
  const limit = Math.min(Math.max(input.limit || 10, 1), 30);
  const place = await geocode(input.location);
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  const query = `[out:json][timeout:25];(nwr(around:12000,${lat},${lon})${tagFilter(input.category)};);out center tags;`;
  const r = await fetch(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "text/plain", "User-Agent": "Northstar/1.0 business-discovery" },
    body: query,
    cache: "no-store"
  });
  if (!r.ok) throw new Error("Business discovery provider failed");
  const data = await r.json() as { elements?: Element[] };
  const seen = new Set<string>();
  const results: Opportunity[] = [];

  for (const element of data.elements || []) {
    const tags = element.tags || {};
    const businessName = tags.name?.trim();
    if (!businessName) continue;
    const key = `${businessName.toLowerCase()}|${tags["addr:street"] || ""}|${tags["addr:housenumber"] || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const scored = score(tags);
    const location = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"], tags["addr:state"]].filter(Boolean).join(" ") || place.display_name;
    results.push({
      id: id("opp"),
      businessName,
      website: tags.website || tags["contact:website"],
      category: input.category || tags.amenity || tags.shop || tags.craft || "Local business",
      location,
      score: scored.score,
      signals: scored.signals,
      status: "new",
      source: "OpenStreetMap",
      sourceId: `${element.type}/${element.id}`,
      phone: tags.phone || tags["contact:phone"],
      contactEmail: tags["contact:" + "email"],
      createdAt: new Date().toISOString()
    });
  }
  return results.sort((a,b) => b.score - a.score).slice(0, limit);
}
