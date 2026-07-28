# Design Document: AI Provider Management

## Overview

This feature replaces the ad-hoc AI key management (three hardcoded settings: `gemini_api_key`, `ai_fallback_key`, `ai_key_3`) with a dedicated `ai_providers` table, an admin management UI, a provider-agnostic fallback wrapper with retry logic, and request logging. The system supports Groq, Gemini, Cerebras, Mistral, and OpenRouter providers through an adapter pattern, and all existing AI consumers (entranceExamAI, autofill, tabAI, moduleAI) continue to work without interface changes via a backward-compatible export.

## Architecture

The architecture follows a layered pattern with clear separation between UI, service, orchestration, and adapter layers:

```
┌─────────────────────────────────────────────────────────┐
│                    Admin UI (React)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Provider List │  │ Add/Edit Form│  │Health Dashboard│ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
├─────────┼──────────────────┼──────────────────┼─────────┤
│         └──────────────────┼──────────────────┘         │
│                   AI Provider Service                    │
│              src/services/aiProviderService.ts           │
├─────────────────────────────────────────────────────────┤
│                   Fallback Wrapper                        │
│             src/lib/ai/fallbackWrapper.ts                │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Adapter Layer                        │    │
│  │  ┌───────────────────┐  ┌────────────────────┐  │    │
│  │  │ OpenAI-Compatible │  │   Gemini Native    │  │    │
│  │  │ (Groq/Cerebras/   │  │                    │  │    │
│  │  │  Mistral/OpenRouter│  │                    │  │    │
│  │  └───────────────────┘  └────────────────────┘  │    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│               Supabase (PostgreSQL)                      │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │   ai_providers   │  │      ai_request_logs       │  │
│  └──────────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Consumer Compatibility Layer:**
```
┌────────────────────┐     ┌─────────────────────────────┐
│  entranceExamAI.ts │────▶│  generateWithGemini()       │
│  autofill.ts       │     │  (same signature, routes    │
│  tabAI / moduleAI  │     │   internally to fallback)   │
└────────────────────┘     └─────────────────────────────┘
```

## Data Models

### ai_providers Table

```sql
CREATE TABLE ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('groq', 'gemini', 'cerebras', 'mistral', 'openrouter')),
  label TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL,
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, label)
);

-- Auto-assign priority on insert when not provided
CREATE OR REPLACE FUNCTION ai_providers_auto_priority()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.priority IS NULL THEN
    SELECT COALESCE(MAX(priority), 0) + 1 INTO NEW.priority FROM ai_providers;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_providers_auto_priority
  BEFORE INSERT ON ai_providers
  FOR EACH ROW
  EXECUTE FUNCTION ai_providers_auto_priority();

-- Auto-update updated_at on modification
CREATE OR REPLACE FUNCTION ai_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_providers_updated_at
  BEFORE UPDATE ON ai_providers
  FOR EACH ROW
  EXECUTE FUNCTION ai_providers_updated_at();
```

### ai_request_logs Table

```sql
CREATE TABLE ai_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES ai_providers(id) ON DELETE SET NULL,
  prompt_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  latency_ms INTEGER NOT NULL,
  consumer_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_request_logs_created_at ON ai_request_logs(created_at DESC);
CREATE INDEX idx_request_logs_provider_id ON ai_request_logs(provider_id);
```

### TypeScript Types

```typescript
// src/types/aiProvider.ts

export type AIProviderName = 'groq' | 'gemini' | 'cerebras' | 'mistral' | 'openrouter';

export interface AIProvider {
  id: string;
  provider: AIProviderName;
  label: string;
  apiKey: string;
  model: string;
  isEnabled: boolean;
  priority: number;
  lastUsedAt: string | null;
  lastError: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIProviderInsert {
  provider: AIProviderName;
  label: string;
  apiKey: string;
  model: string;
  isEnabled?: boolean;
  priority?: number;
}

export interface AIProviderUpdate {
  label?: string;
  apiKey?: string;
  model?: string;
  isEnabled?: boolean;
  priority?: number;
}

export interface AIRequestLog {
  id: string;
  providerId: string | null;
  promptHash: string;
  status: 'success' | 'error';
  errorMessage: string | null;
  latencyMs: number;
  consumerName: string;
  createdAt: string;
}
```

## Components and Interfaces

### 1. AI Provider Service (`src/services/aiProviderService.ts`)

Handles all CRUD operations for the `ai_providers` table.

```typescript
import { db } from "@/lib/supabase/client";
import type { AIProvider, AIProviderInsert, AIProviderUpdate, AIRequestLog } from "@/types/aiProvider";

function mapProviderRow(row: any): AIProvider {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    apiKey: row.api_key,
    model: row.model,
    isEnabled: row.is_enabled,
    priority: row.priority,
    lastUsedAt: row.last_used_at,
    lastError: row.last_error,
    usageCount: row.usage_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllProviders(): Promise<AIProvider[]>;
export async function getEnabledProviders(): Promise<AIProvider[]>;
export async function createProvider(data: AIProviderInsert): Promise<AIProvider>;
export async function updateProvider(id: string, data: AIProviderUpdate): Promise<AIProvider>;
export async function deleteProvider(id: string): Promise<void>;
export async function updateProviderPriorities(orderedIds: string[]): Promise<void>;
export async function recordProviderSuccess(id: string): Promise<void>;
export async function recordProviderError(id: string, error: string): Promise<void>;
export async function getRecentLogs(limit?: number): Promise<AIRequestLog[]>;
export async function insertRequestLog(log: Omit<AIRequestLog, 'id' | 'createdAt'>): Promise<void>;
```

### 2. Provider Adapters (`src/lib/ai/adapters/`)

#### Unified Interface

```typescript
// src/lib/ai/adapters/types.ts

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
```

#### OpenAI-Compatible Adapter (`src/lib/ai/adapters/openai-compatible.ts`)

Supports Groq, Cerebras, Mistral, and OpenRouter via configurable base URL.

```typescript
import type { AdapterRequest, AdapterResponse, ProviderAdapter } from "./types";
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
    if (!this.baseUrl) throw new Error(`Unsupported OpenAI-compatible provider: ${provider}`);
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
    } finally {
      clearTimeout(timeout);
    }
  }
}
```

#### Gemini Adapter (`src/lib/ai/adapters/gemini.ts`)

```typescript
import type { AdapterRequest, AdapterResponse, ProviderAdapter } from "./types";

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
    } finally {
      clearTimeout(timeout);
    }
  }
}
```

#### Shared Error Class

```typescript
// src/lib/ai/adapters/types.ts

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
  catch { return ""; }
}
```

### 3. Fallback Wrapper (`src/lib/ai/fallbackWrapper.ts`)

The core orchestration layer that replaces `client.ts` logic.

```typescript
import { getEnabledProviders, recordProviderSuccess, recordProviderError, insertRequestLog } from "@/services/aiProviderService";
import { OpenAICompatibleAdapter } from "./adapters/openai-compatible";
import { GeminiAdapter } from "./adapters/gemini";
import { AdapterError } from "./adapters/types";
import type { AIProvider } from "@/types/aiProvider";
import type { ProviderAdapter } from "./adapters/types";

function getAdapter(provider: AIProvider): ProviderAdapter {
  if (provider.provider === "gemini") return new GeminiAdapter();
  return new OpenAICompatibleAdapter(provider.provider);
}

function hashPrompt(prompt: string): string {
  // SHA-256 via SubtleCrypto (browser-native)
  // Falls back to simple hash if SubtleCrypto unavailable
}

export async function generateWithFallback(
  prompt: string,
  consumerName: string
): Promise<string> {
  const providers = await getEnabledProviders(); // ordered by priority ASC

  if (providers.length === 0) {
    throw new Error("No AI providers configured. Add keys in Settings → AI.");
  }

  let lastError: Error | null = null;

  for (const provider of providers) {
    const adapter = getAdapter(provider);
    const startTime = Date.now();

    try {
      const response = await adapter.generate({
        prompt,
        apiKey: provider.apiKey,
        model: provider.model,
      });

      const latencyMs = Date.now() - startTime;

      // Record success (fire-and-forget to not block response)
      recordProviderSuccess(provider.id).catch(() => {});
      insertRequestLog({
        providerId: provider.id,
        promptHash: await hashPrompt(prompt),
        status: "success",
        errorMessage: null,
        latencyMs,
        consumerName,
      }).catch(() => {}); // Requirement 8.5: logging failure doesn't interrupt response

      return response.content;
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const error = err instanceof AdapterError ? err : new AdapterError(0, String(err));
      lastError = error;

      // Record error
      recordProviderError(provider.id, error.message).catch(() => {});
      insertRequestLog({
        providerId: provider.id,
        promptHash: await hashPrompt(prompt),
        status: "error",
        errorMessage: error.message,
        latencyMs,
        consumerName,
      }).catch(() => {});

      // Non-retryable errors: stop immediately
      if (!error.isRetryable) {
        throw error;
      }
      // Retryable: continue to next provider
    }
  }

  throw lastError ?? new Error("All configured AI keys failed.");
}
```

### 4. Backward-Compatible Export (`src/lib/gemini/client.ts` — updated)

```typescript
import { generateWithFallback } from "@/lib/ai/fallbackWrapper";
import { getEnabledProviders } from "@/services/aiProviderService";

/**
 * Backward-compatible wrapper.
 * Signature matches the original generateWithGemini.
 * Internally routes to the new fallback system.
 */
export async function generateWithGemini(
  prompt: string,
  apiKey: string,
  model?: string,
  fallbackKey?: string,
  fallbackModel?: string,
  fallbackKey2?: string
): Promise<string> {
  // Try the new provider system first
  try {
    const providers = await getEnabledProviders();
    if (providers.length > 0) {
      return await generateWithFallback(prompt, "legacy-consumer");
    }
  } catch {
    // Fall through to legacy behavior
  }

  // Fallback: use passed parameters directly (Requirement 6.4)
  return legacyGenerate(prompt, apiKey, model, fallbackKey, fallbackModel, fallbackKey2);
}

// Legacy implementation preserved for backward compatibility when no providers configured
function legacyGenerate(...args: [string, string, string?, string?, string?, string?]): Promise<string> {
  // Original client.ts logic (cleaned keys, detect provider, try in order)
}
```

### 5. Admin UI Components

#### Provider List (`src/components/settings/AIProviderList.tsx`)

Uses `@dnd-kit/sortable` for drag-and-drop reordering.

```typescript
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";

interface Props {
  providers: AIProvider[];
  onReorder: (orderedIds: string[]) => void;
  onEdit: (provider: AIProvider) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onTest: (provider: AIProvider) => void;
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}${"•".repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
}
```

#### Provider Form (`src/components/settings/AIProviderForm.tsx`)

```typescript
interface AIProviderFormProps {
  provider?: AIProvider; // undefined = add mode, defined = edit mode
  onSubmit: (data: AIProviderInsert | AIProviderUpdate) => void;
  onCancel: () => void;
}
```

#### Health Dashboard (`src/components/settings/AIHealthDashboard.tsx`)

```typescript
interface HealthDashboardProps {
  providers: AIProvider[];
  recentLogs: AIRequestLog[];
  onRefresh: () => void;
}
```

### 6. Migration Script

```sql
-- Migration: move existing keys from settings to ai_providers

DO $$
DECLARE
  v_gemini_key TEXT;
  v_fallback_key TEXT;
  v_key_3 TEXT;
  v_gemini_model TEXT;
  v_fallback_model TEXT;
  v_provider TEXT;
BEGIN
  -- Read existing settings
  SELECT value::TEXT INTO v_gemini_key FROM settings WHERE key = 'gemini_api_key';
  SELECT value::TEXT INTO v_fallback_key FROM settings WHERE key = 'ai_fallback_key';
  SELECT value::TEXT INTO v_key_3 FROM settings WHERE key = 'ai_key_3';
  SELECT value::TEXT INTO v_gemini_model FROM settings WHERE key = 'gemini_model';
  SELECT value::TEXT INTO v_fallback_model FROM settings WHERE key = 'ai_fallback_model';

  -- Strip JSON quotes if present
  v_gemini_key := TRIM(BOTH '"' FROM COALESCE(v_gemini_key, ''));
  v_fallback_key := TRIM(BOTH '"' FROM COALESCE(v_fallback_key, ''));
  v_key_3 := TRIM(BOTH '"' FROM COALESCE(v_key_3, ''));
  v_gemini_model := TRIM(BOTH '"' FROM COALESCE(v_gemini_model, 'llama-3.3-70b-versatile'));
  v_fallback_model := TRIM(BOTH '"' FROM COALESCE(v_fallback_model, 'llama-3.3-70b-versatile'));

  -- Migrate key 1
  IF LENGTH(v_gemini_key) > 5 THEN
    v_provider := CASE WHEN v_gemini_key LIKE 'gsk_%' THEN 'groq' ELSE 'gemini' END;
    INSERT INTO ai_providers (provider, label, api_key, model, priority)
    VALUES (v_provider, 'Primary (migrated)', v_gemini_key, v_gemini_model, 1)
    ON CONFLICT (provider, label) DO NOTHING;
  END IF;

  -- Migrate key 2
  IF LENGTH(v_fallback_key) > 5 THEN
    v_provider := CASE WHEN v_fallback_key LIKE 'gsk_%' THEN 'groq' ELSE 'gemini' END;
    INSERT INTO ai_providers (provider, label, api_key, model, priority)
    VALUES (v_provider, 'Fallback 1 (migrated)', v_fallback_key, v_fallback_model, 2)
    ON CONFLICT (provider, label) DO NOTHING;
  END IF;

  -- Migrate key 3
  IF LENGTH(v_key_3) > 5 THEN
    v_provider := CASE WHEN v_key_3 LIKE 'gsk_%' THEN 'groq' ELSE 'gemini' END;
    INSERT INTO ai_providers (provider, label, api_key, model, priority)
    VALUES (v_provider, 'Fallback 2 (migrated)', v_key_3,
      CASE WHEN v_key_3 LIKE 'gsk_%' THEN 'llama-3.3-70b-versatile' ELSE 'gemini-2.5-flash' END, 3)
    ON CONFLICT (provider, label) DO NOTHING;
  END IF;
END $$;
```

### 7. Log Retention (Scheduled Cleanup)

```sql
-- Run daily via pg_cron or Supabase scheduled function
DELETE FROM ai_request_logs WHERE created_at < now() - INTERVAL '30 days';
```

Alternatively, implemented as a Supabase Edge Function triggered by cron, or called lazily before each dashboard load.

## Error Handling

| Error Type | HTTP Status | Behavior |
|---|---|---|
| Rate Limited | 429 | Retryable → fallback to next key |
| Payload Too Large | 413 | Retryable → fallback to next key |
| Server Error | 5xx | Retryable → fallback to next key |
| Invalid API Key | 401 | Non-retryable → throw immediately |
| Forbidden | 403 | Non-retryable → throw immediately |
| Not Found (model) | 404 | Non-retryable → throw immediately |
| Timeout (30s) | — | Retryable → fallback to next key |
| Network Error | — | Retryable → fallback to next key |

**Logging resilience:** All `insertRequestLog` and `recordProvider*` calls use fire-and-forget (`.catch(() => {})`) so that logging failures never block the AI response path.

## Interfaces

### Service Layer API

```typescript
// aiProviderService.ts exports:
getAllProviders(): Promise<AIProvider[]>
getEnabledProviders(): Promise<AIProvider[]>  // ordered by priority ASC
createProvider(data: AIProviderInsert): Promise<AIProvider>
updateProvider(id: string, data: AIProviderUpdate): Promise<AIProvider>
deleteProvider(id: string): Promise<void>
updateProviderPriorities(orderedIds: string[]): Promise<void>
recordProviderSuccess(id: string): Promise<void>
recordProviderError(id: string, error: string): Promise<void>
getRecentLogs(limit?: number): Promise<AIRequestLog[]>
insertRequestLog(log: Omit<AIRequestLog, 'id' | 'createdAt'>): Promise<void>
getDashboardStats(): Promise<{ totalRequests: number; enabledKeys: number }>
```

### Fallback Wrapper API

```typescript
// Internal API (new code should use this):
generateWithFallback(prompt: string, consumerName: string): Promise<string>

// Public API (backward-compatible, same signature as before):
generateWithGemini(prompt, apiKey, model?, fallbackKey?, fallbackModel?, fallbackKey2?): Promise<string>
```

### Adapter Interface

```typescript
interface ProviderAdapter {
  generate(request: AdapterRequest): Promise<AdapterResponse>;
}
```

## Testing Strategy

**Unit Tests (vitest):**
- Adapter routing logic (provider → correct adapter class)
- API key masking function
- Provider detection from key prefix
- Priority reordering logic
- Error classification (retryable vs non-retryable)

**Property-Based Tests (fast-check + vitest):**
- Fallback ordering and traversal (Property 6)
- Non-retryable error short-circuit (Property 7)
- API key masking (Property 4)
- Provider detection from prefix (Property 11)
- Default generation parameters per provider (Property 10)
- Priority reordering consistency (Property 5)
- Logging failure resilience (Property 15)

**Integration Tests:**
- Full CRUD flow on ai_providers table
- Migration script correctness
- Health dashboard data aggregation
- Consumer compatibility (entranceExamAI, autofill import resolution)

**Test Configuration:**
- Minimum 100 iterations per property-based test
- Use fast-check for random input generation
- Mock fetch for adapter tests (no real API calls in tests)
- Use Supabase test schema for database integration tests

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Schema constraint enforcement

*For any* attempted insert into ai_providers, if the provider value is not in {groq, gemini, cerebras, mistral, openrouter}, or if the (provider, label) combination already exists, the insert SHALL be rejected.

**Validates: Requirements 1.2, 1.4**

### Property 2: Auto-priority assignment

*For any* sequence of inserts into ai_providers where priority is not explicitly specified, each new record SHALL receive a priority value equal to the maximum existing priority plus one (or 1 if the table is empty).

**Validates: Requirements 1.5**

### Property 3: Timestamp invariants

*For any* provider record, after insertion created_at is non-null, and after any update operation, updated_at SHALL be greater than or equal to the previous updated_at value.

**Validates: Requirements 1.3**

### Property 4: API key masking

*For any* API key string of length greater than 8, the masked representation SHALL expose only the first 4 and last 4 characters, with all middle characters replaced by mask characters.

**Validates: Requirements 2.1**

### Property 5: Priority reordering consistency

*For any* list of N provider records and any valid reorder operation (moving item from position i to position j), the resulting priority values SHALL form a consecutive ascending sequence matching the new visual order, with no gaps or duplicates.

**Validates: Requirements 2.6**

### Property 6: Fallback ordering and traversal

*For any* set of enabled providers with distinct priorities, the Fallback Wrapper SHALL attempt keys in strictly ascending priority order, and for any retryable error at position k, the key at position k+1 SHALL be attempted next.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 7: Non-retryable error short-circuit

*For any* provider list where the key at position k returns a non-retryable error (401, 403, 404), no keys at positions greater than k SHALL be attempted, and the error SHALL be thrown to the caller.

**Validates: Requirements 3.4**

### Property 8: Provider metadata update on completion

*For any* completed request: if successful, the serving provider's usage_count SHALL increment by 1 and last_used_at SHALL update to the current time; if errored, the provider's last_error SHALL contain the error message.

**Validates: Requirements 3.6, 3.7**

### Property 9: Adapter routing correctness

*For any* provider record, if the provider is "gemini" the Gemini adapter SHALL be used (x-goog-api-key header, generateContent endpoint); otherwise the OpenAI-compatible adapter SHALL be used with the correct base URL for that provider.

**Validates: Requirements 4.2, 4.3, 4.4**

### Property 10: Default generation parameters

*For any* OpenAI-compatible adapter request, max_tokens SHALL be 4096 and temperature SHALL be 0.7. For any Gemini adapter request, maxOutputTokens SHALL be 8192 and temperature SHALL be 0.7.

**Validates: Requirements 4.6**

### Property 11: Provider detection from key prefix

*For any* API key string, if it starts with "gsk_" the detected provider SHALL be "groq"; if it starts with "AIza" the detected provider SHALL be "gemini".

**Validates: Requirements 5.2**

### Property 12: Backward-compatible fallback behavior

*For any* call to generateWithGemini where the ai_providers table has enabled keys, the passed key parameters SHALL be ignored and the request SHALL route through the fallback wrapper using table-stored keys instead.

**Validates: Requirements 6.2**

### Property 13: Health indicator derivation

*For any* set of provider records, the health dashboard SHALL display a green indicator for providers with null last_error and a red indicator for providers with non-null last_error. The total requests displayed SHALL equal the sum of all usage_count values, and the enabled key count SHALL equal the count of records where is_enabled is true.

**Validates: Requirements 7.2, 7.4**

### Property 14: Request log completeness

*For any* completed Fallback Wrapper request (success or error), the resulting log entry SHALL contain a non-null provider_id, a SHA-256 prompt_hash, the correct status, latency_ms > 0, and a non-empty consumer_name.

**Validates: Requirements 8.1**

### Property 15: Logging failure resilience

*For any* successful AI generation, if the insertRequestLog or recordProviderSuccess operation throws an error, the AI response SHALL still be returned to the caller without interruption.

**Validates: Requirements 8.5**

