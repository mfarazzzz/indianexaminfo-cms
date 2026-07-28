/**
 * OpenAI-compatible adapter — supports Groq, Cerebras, Mistral, OpenRouter.
 */
import type { AdapterRequest, AdapterResponse, ProviderAdapter } from "./types";
import { AdapterError } from "./types";
import type { AIProviderName } from "@/types/aiProvider";

const BASE_URLS: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1",
  cerebras: "https://api.cerebras.ai/v1",
  mistral: "https://api.mistral.ai/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

export class OpenAICompatibleAdapter implements ProviderAdapter {
  private baseUrl: string;

  constructor(provider: AIProviderName) {
    this.baseUrl = BASE_URLS[provider];
    if (!this.baseUrl) throw new Error(`Unsupported provider: ${provider}`);
  }

  async generate(request: AdapterRequest): Promise<AdapterResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${request.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: [{ role: "user", content: request.prompt }],
          temperature: 0.7,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new AdapterError(res.status, body);
      }

      const data = await res.json();
      return { content: data.choices?.[0]?.message?.content ?? "" };
    } catch (err) {
      if (err instanceof AdapterError) throw err;
      if ((err as any)?.name === "AbortError") throw new AdapterError(408, "Request timed out (30s)");
      throw new AdapterError(0, String(err));
    } finally {
      clearTimeout(timeout);
    }
  }
}
