export const LLM_BASE_URL =
  process.env.LLM_BASE_URL ?? "https://llm.qcall.ai/v1/chat/completions";

export const LLM_MODEL = process.env.LLM_MODEL ?? "qcall/slm-3b-int4";

export const LLM_API_KEY = process.env.LLM_API_KEY ?? "";

export async function callLLM(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (LLM_API_KEY) {
    headers["Authorization"] = `Bearer ${LLM_API_KEY}`;
  }

  const body: Record<string, unknown> = {
    model: LLM_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 2048,
    stream: false,
  };

  // Disable thinking mode for models that support it (qcall)
  if (LLM_MODEL.includes("qcall")) {
    body.chat_template_kwargs = { enable_thinking: false };
  }

  const response = await fetch(LLM_BASE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("LLM returned no content");
  }

  return content;
}
