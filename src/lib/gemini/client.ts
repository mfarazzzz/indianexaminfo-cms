/**
 * Gemini client — uses the native REST API directly.
 * 
 * Supports both legacy AIzaSy... keys and new AQ. auth keys.
 * Uses x-goog-api-key header (recommended by Google for AQ. keys).
 */

/** Strip wrapping quotes that Supabase jsonb may add */
function cleanKey(raw: string): string {
  return raw.replace(/^["']|["']$/g, '').trim();
}

export async function generateWithGemini(
  prompt: string,
  apiKey: string,
  model: string = "gemini-2.5-flash"
): Promise<string> {
  const key = cleanKey(apiKey);
  if (!key) throw new Error("Gemini API key not configured. Set it in Settings → AI.");

  // Use x-goog-api-key header (works better with AQ. auth keys)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });

  if (res.status === 429) {
    throw new Error("Rate limited by Google. Wait 60 seconds and try again.");
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[Gemini] API error:", res.status, errBody.slice(0, 500));
    
    // Parse Google's error for a more helpful message
    let detail = "";
    try {
      const errJson = JSON.parse(errBody);
      detail = errJson?.error?.message || "";
    } catch {}

    if (res.status === 400 && (detail.includes("API_KEY") || detail.includes("API key"))) {
      throw new Error("Invalid API key. Make sure you copied the full key from Google AI Studio.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`API key rejected (${res.status}). ${detail || "Your AQ. key may need billing enabled. Check Google AI Studio."}`);
    }
    if (res.status === 404) {
      throw new Error(`Model "${model}" not found. ${detail || "Try gemini-2.5-flash or check available models in AI Studio."}`);
    }
    throw new Error(`Gemini API error (${res.status}). ${detail || "Check console for details."}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

/**
 * List available models for the given API key.
 * Useful for debugging which models your key has access to.
 */
export async function listAvailableModels(apiKey: string): Promise<string[]> {
  const key = cleanKey(apiKey);
  if (!key) return [];
  
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": key },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: any) => m.name?.replace("models/", "") || "")
      .filter(Boolean);
  } catch {
    return [];
  }
}
