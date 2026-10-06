import type { Opportunity } from "./types";

export async function verifyWebsite(opportunity: Opportunity): Promise<Pick<Opportunity, "websiteVerified" | "websiteStatus" | "websiteTitle">> {
  if (!opportunity.website) return { websiteVerified: false };
  let url: URL;
  try {
    url = new URL(opportunity.website.startsWith("http") ? opportunity.website : `https://${opportunity.website}`);
  } catch {
    return { websiteVerified: false };
  }
  if (!["http:", "https:"].includes(url.protocol)) return { websiteVerified: false };

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Northstar/1.0 website-verifier" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store"
    });
    const html = await response.text();
    const title = html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)?.[1]?.replace(/\\s+/g, " ").trim().slice(0, 180);
    return {
      websiteVerified: response.ok,
      websiteStatus: response.status,
      websiteTitle: title
    };
  } catch {
    return { websiteVerified: false };
  }
}
