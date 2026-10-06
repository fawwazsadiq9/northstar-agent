import { generateText } from "./ai";
import { id } from "./id";
import { audit } from "./audit";
import { updateDB } from "./store";
import { fallbackWebsite } from "./website";
import type { Asset, Opportunity } from "./types";

const system = `You are Northstar, an autonomous revenue operator. Create useful, truthful execution assets. Never invent facts about a business. If evidence is missing, label the claim as an assumption. Never send messages, publish websites, charge money, or perform external side effects; create drafts that require approval.`;

export async function generateOffer(opportunity: Opportunity): Promise<Asset> {
  const content = await generateText({
    system,
    prompt: `Create a concise revenue-recovery offer for this opportunity:
Business: ${opportunity.businessName}
Category: ${opportunity.category}
Location: ${opportunity.location}
Signals: ${opportunity.signals.join("; ")}
Score: ${opportunity.score}
Return only the customer-facing offer copy.`
  });
  const asset: Asset = { id:id("asset"), opportunityId:opportunity.id, type:"offer", title:"AI revenue recovery offer", content, status:"ready", createdAt:new Date().toISOString() };
  await updateDB(db => db.assets.unshift(asset));
  await audit("asset.generated","system","asset",asset.id,{opportunityId:opportunity.id});
  return asset;
}

export async function generateWebsite(opportunity: Opportunity): Promise<Asset> {
  let content: string;
  let title = "AI-generated deployable website";
  try {
    content = await generateText({
      system: system + ` Return ONLY a complete self-contained HTML document. Use inline CSS and vanilla JavaScript only. Do not invent reviews, prices, credentials, awards, addresses, hours or testimonials. Do not add external scripts, tracking pixels, analytics, network requests, or forms that transmit data.`,
      prompt: `Generate a polished lead-generation website for:
Business: ${opportunity.businessName}
Category: ${opportunity.category}
Location: ${opportunity.location}
Known phone: ${opportunity.phone || "not provided"}
Known website: ${opportunity.website || "not provided"}
Evidence: ${opportunity.signals.join("; ")}
Include hero, value/services section using safe generic language, CTA, contact form UI, accessibility and mobile responsiveness. The form must remain a UI-only demo until a CRM is connected.`
    });
    if (!content.toLowerCase().includes("<html")) throw new Error("AI returned invalid HTML");
  } catch {
    content = fallbackWebsite(opportunity);
    title = "Deployable website (deterministic fallback)";
  }
  const asset: Asset = { id:id("asset"), opportunityId:opportunity.id, type:"website", title, content, status:"draft", createdAt:new Date().toISOString() };
  await updateDB(db => db.assets.unshift(asset));
  await audit("asset.generated","system","asset",asset.id,{opportunityId:opportunity.id,type:"website",deployable:true});
  return asset;
}

export async function draftOutreach(opportunity: Opportunity) {
  const content = await generateText({
    system,
    prompt: `Write a short, personalized B2B outreach email for ${opportunity.businessName}. Use only these evidence signals: ${opportunity.signals.join("; ")}. Do not use fake statistics, fake personalization, false urgency, or claims of prior contact. End with a low-friction question.`
  });
  const asset: Asset = { id:id("asset"), opportunityId:opportunity.id, type:"email", title:"Personalized outreach draft", content, status:"draft", createdAt:new Date().toISOString() };
  await updateDB(db => db.assets.unshift(asset));
  await audit("outreach.drafted","system","asset",asset.id,{opportunityId:opportunity.id});
  return asset;
}
