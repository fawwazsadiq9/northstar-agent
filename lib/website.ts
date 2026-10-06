import type { Opportunity } from "./types";

function escape(value: string) {
  return value.replace(/[&<>"]/g, c => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    return "&quot;";
  });
}

export function fallbackWebsite(opportunity: Opportunity) {
  const name = escape(opportunity.businessName);
  const category = escape(opportunity.category);
  const location = escape(opportunity.location);
  const phone = opportunity.phone ? escape(opportunity.phone) : "";
  const intake = escape(process.env.NORTHSTAR_PUBLIC_URL || "");
  const opportunityId = escape(opportunity.id);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} — ${category}</title><style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#090b10;color:#f7f7f7}main{max-width:980px;margin:auto;padding:80px 24px}h1{font-size:clamp(48px,8vw,86px);line-height:.95;letter-spacing:-.06em}p{color:#a7adb8;font-size:19px;line-height:1.6}.cta{display:inline-block;background:#fff;color:#08090b;padding:16px 22px;text-decoration:none;font-weight:800;border-radius:4px;border:0;cursor:pointer}.card{margin-top:80px;border:1px solid #272b33;padding:28px}input,textarea{width:100%;box-sizing:border-box;background:#11141a;color:#fff;border:1px solid #303540;padding:13px;border-radius:4px}textarea{min-height:120px}#status{margin-top:12px;color:#a7adb8;font-size:14px}</style></head><body><main><small>${location} · ${category}</small><h1>${name}</h1><p>A clearer way to turn high-intent inquiries into conversations. Get in touch to discuss your needs.</p>${phone ? `<p><a class="cta" href="tel:${phone}">Call now →</a></p>` : `<a class="cta" href="#contact">Request a consultation →</a>`}<div class="card" id="contact"><h2>Start a conversation</h2><p>Tell us what you need and our team will respond.</p><form id="lead-form"><input name="name" required placeholder="Name"><br><br><input name="email" required type="email" placeholder="Email"><br><br><input name="phone" placeholder="Phone"><br><br><textarea name="message" placeholder="How can we help?"></textarea><input type="text" name="company" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"><br><br><button class="cta" type="submit">Send inquiry</button></form><div id="status"></div></div></main><script>const form=document.getElementById("lead-form");const status=document.getElementById("status");form.addEventListener("submit",async(e)=>{e.preventDefault();status.textContent="Sending…";const data=Object.fromEntries(new FormData(form).entries());data.opportunityId="${opportunityId}";data.source="website";try{const res=await fetch("${intake}/api/leads/intake",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});const json=await res.json().catch(()=>({}));if(!res.ok)throw new Error(json.error||"Unable to send inquiry");form.reset();status.textContent="Thanks — your inquiry has been received."}catch(err){status.textContent=err.message||"Unable to send inquiry."}});</script></body></html>`;
}