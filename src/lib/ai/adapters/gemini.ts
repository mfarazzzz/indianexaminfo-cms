/**
 * Gemini native adapter — Google Generative Language API.
 */
import type { AdapterRequest, AdapterResponse, ProviderAdapter } from "./types";
import { AdapterError } from "./types";

export class GeminiAdapter implements ProviderAdapter {
  async generate(request: AdapterRequest): Promise<AdapterResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": request.apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: request.prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new AdapterError(res.status, body);
      }

      const data = await res.json();
      return { content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "" };
    } catch (err) {
      if (err instanceof AdapterError) throw err;
      if ((err as any)?.name === "AbortError") throw new AdapterError(408, "Request timed out (30s)");
      throw new AdapterError(0, String(err));
    } finally {
      clearTimeout(timeout);
    }
  }
}
