/**
 * Gemini client — uses the native REST API directly.
 * 
 * WHY NOT the @google/generative-ai SDK?
 * Google switched to new "Auth keys" (AQ. prefix) in mid-2026.
 * Older SDK versions don't handle AQ. keys reliably.
 * The native REST endpoint with ?key= works perfectly for both
 * legacy AIzaSy... keys AND new AQ. keys.
 */

/** Strip wrapping quotes that Supabase jsonb may add */
function cleanKey(raw: string): string {
  return raw.replace(/^["']|["']$/g, '').trim();
}

export async function generateWithGemini(
  prompt: string,
  apiKey: string,
  model: string = "gemini-2.0-flash"
): Promise<string> {
  const key = cleanKey(apiKey);
  if (!key) throw new Error("Gemini API key not configured. Set it in Settings → AI.");

  // AQ. auth keys work on both v1 and v1beta; use v1beta for widest model support
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    console.error("[Gemini] API error:", res.status, errBody.slice(0, 300));
    
    // Parse Google's error for a more helpful message
    let detail = "";
    try {
      const errJson = JSON.parse(errBody);
      detail = errJson?.error?.message || "";
    } catch {}

    if (res.status === 400 && detail.includes("API_KEY")) {
      throw new Error("Invalid API key format. Make sure you copied the full key from Google AI Studio.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`API key rejected (${res.status}). ${detail || "Verify your key is active in Google AI Studio."}`);
    }
    if (res.status === 404) {
      throw new Error(`Model "${model}" not found. Try switching to gemini-2.0-flash in Settings → AI.`);
    }
    throw new Error(`Gemini API error (${res.status}). ${detail || "Check your API key and model."}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}
