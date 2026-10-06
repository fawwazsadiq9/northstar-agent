import { generateText } from "./ai";
import { id } from "./id";
import { audit } from "./audit";
import { updateDB } from "./store";
import type { Asset, Opportunity } from "./types";

const system = `You are Northstar, an autonomous revenue operator. Your job is to identify concrete business revenue opportunities and create useful, truthful execution assets. Never invent facts about a business. If evidence is missing, label the claim as an assumption. Never send messages, publish websites, charge money, or perform external side effects; create drafts that require approval.`;

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

export async function generateWebsiteBlueprint(opportunity: Opportunity) {
  const content = await generateText({
    system,
    prompt: `Create a website blueprint for ${opportunity.businessName}, a ${opportunity.category} business in ${opportunity.location}. Signals: ${opportunity.signals.join("; ")}. Include sections, CTA, lead form fields, trust elements and an AI lead-response workflow. Do not invent reviews, prices, credentials or awards.`
  });
  const asset: Asset = { id:id("asset"), opportunityId:opportunity.id, type:"website", title:"AI website blueprint", content, status:"draft", createdAt:new Date().toISOString() };
  await updateDB(db => db.assets.unshift(asset));
  await audit("asset.generated","system","asset",asset.id,{opportunityId:opportunity.id,type:"website"});
  return asset;
}

export async function draftOutreach(opportunity: Opportunity) {
  const content = await generateText({
    system,
    prompt: `Write a short, personalized B2B outreach email for ${opportunity.businessName}. Explain one observed opportunity without pretending to have verified anything beyond these signals: ${opportunity.signals.join("; ")}. Offer a specific next step. Do not use fake statistics, fake personalization, false urgency, or claims of prior contact. End with a low-friction question.`
  });
  const asset: Asset = { id:id("asset"), opportunityId:opportunity.id, type:"email", title:"Personalized outreach draft", content, status:"draft", createdAt:new Date().toISOString() };
  await updateDB(db => db.assets.unshift(asset));
  await audit("outreach.drafted","system","asset",asset.id,{opportunityId:opportunity.id});
  return asset;
}