/**
 * Unified adapter interface for AI providers.
 */

export interface AdapterRequest {
  prompt: string;
  apiKey: string;
  model: string;
}

export interface AdapterResponse {
  content: string;
}

export interface ProviderAdapter {
  generate(request: AdapterRequest): Promise<AdapterResponse>;
}

export class AdapterError extends Error {
  constructor(public readonly statusCode: number, public readonly responseBody: string) {
    const detail = tryParseErrorMessage(responseBody);
    super(`API error (${statusCode})${detail ? `: ${detail}` : ""}`);
    this.name = "AdapterError";
  }

  get isRetryable(): boolean {
    return this.statusCode === 429 || this.statusCode === 413 || this.statusCode >= 500;
  }
}

function tryParseErrorMessage(body: string): string {
  try { return JSON.parse(body)?.error?.message ?? ""; }
  catch { return body.slice(0, 200); }
}
