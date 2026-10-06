type GenerateInput = { system: string; prompt: string; temperature?: number };

export async function generateText(input: GenerateInput): Promise<string> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error("AI_GATEWAY_API_KEY is not configured");

  const model = process.env.NORTHSTAR_AI_MODEL || "alibaba/qwen3-max";
  const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: input.temperature ?? 0.2,
      messages: [{ role: "system", content: input.system }, { role: "user", content: input.prompt }]
    }),
    cache: "no-store"
  });

  if (!response.ok) throw new Error(`AI provider error: ${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("AI provider returned no text");
  return text;
}