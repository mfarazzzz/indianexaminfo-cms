/**
 * AI client — supports multiple providers (Groq, Gemini).
 * 
 * Groq is the recommended provider: fast, reliable, generous free tier.
 * Gemini is kept as an option but has known issues with AQ. auth keys.
 */

/** Strip wrapping quotes that Supabase jsonb may add */
function cleanKey(raw: string): string {
  return raw.replace(/^["']|["']$/g, '').trim();
}

// ── Groq (OpenAI-compatible) ─────────────────────────────────────────────────

async function generateWithGroq(prompt: string, apiKey: string, model: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (res.status === 429) {
    throw new Error("Rate limited by Groq. Wait a moment and try again.");
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[Groq] API error:", res.status, errBody.slice(0, 300));
    let detail = "";
    try { detail = JSON.parse(errBody)?.error?.message || ""; } catch {}
    if (res.status === 401) throw new Error("Invalid Groq API key. Check Settings → AI.");
    throw new Error(`Groq API error (${res.status}). ${detail}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ── Gemini (native REST) ─────────────────────────────────────────────────────

async function generateWithGeminiDirect(prompt: string, apiKey: string, model: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    }),
  });

  if (res.status === 429) throw new Error("Rate limited by Google. Wait 60 seconds.");
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[Gemini] API error:", res.status, errBody.slice(0, 300));
    let detail = "";
    try { detail = JSON.parse(errBody)?.error?.message || ""; } catch {}
    if (res.status === 401 || res.status === 403) throw new Error(`Gemini key rejected (${res.status}). ${detail}`);
    if (res.status === 404) throw new Error(`Model "${model}" not found. ${detail}`);
    throw new Error(`Gemini error (${res.status}). ${detail}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Detect provider from API key format */
function detectProvider(apiKey: string): "groq" | "gemini" {
  if (apiKey.startsWith("gsk_")) return "groq";
  return "gemini";
}

/** Default model for each provider */
const DEFAULT_MODELS: Record<string, string> = {
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.5-flash",
};

export async function generateWithGemini(
  prompt: string,
  apiKey: string,
  model?: string
): Promise<string> {
  const key = cleanKey(apiKey);
  if (!key) throw new Error("API key not configured. Set it in Settings → AI.");

  const provider = detectProvider(key);
  const finalModel = model || DEFAULT_MODELS[provider];

  if (provider === "groq") {
    return generateWithGroq(prompt, key, finalModel);
  }
  return generateWithGeminiDirect(prompt, key, finalModel);
}

/** List available models (for debugging) */
export async function listAvailableModels(apiKey: string): Promise<string[]> {
  const key = cleanKey(apiKey);
  if (!key) return [];
  const provider = detectProvider(key);

  try {
    if (provider === "groq") {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${key}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || []).map((m: any) => m.id).filter(Boolean);
    } else {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": key },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: any) => m.name?.replace("models/", "") || "")
        .filter(Boolean);
    }
  } catch {
    return [];
  }
}
