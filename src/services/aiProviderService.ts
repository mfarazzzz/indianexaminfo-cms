/**
 * aiProviderService.ts — CRUD for the ai_providers table (which model to use, in
 * what order) plus the request log board.
 *
 * No function here reads, writes or returns a key. The key is an Edge Function
 * secret, and the only component that calls the AI is the `ai-fill` function, so
 * these browser helpers deal with metadata only. Health columns (last_used_at,
 * last_error) are written by the function, not from here.
 */
import { db } from "@/lib/supabase/client";
import type { AIProvider, AIProviderInsert, AIProviderUpdate, AIRequestLog } from "@/types/aiProvider";

function mapRow(row: any): AIProvider {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    model: row.model,
    isEnabled: row.is_enabled,
    priority: row.priority,
    lastUsedAt: row.last_used_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLogRow(row: any): AIRequestLog {
  return {
    id: row.id,
    providerId: row.provider_id,
    userId: row.user_id ?? null,
    promptHash: row.prompt_hash,
    status: row.status,
    errorMessage: row.error_message,
    latencyMs: row.latency_ms,
    consumerName: row.consumer_name,
    createdAt: row.created_at,
  };
}

export async function getAllProviders(): Promise<AIProvider[]> {
  const { data, error } = await db.from("ai_providers").select("*").order("priority");
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function createProvider(input: AIProviderInsert): Promise<AIProvider> {
  const { data, error } = await db.from("ai_providers").insert({
    provider: input.provider,
    label: input.label,
    model: input.model,
    is_enabled: input.isEnabled ?? true,
    priority: input.priority ?? 0,
  }).select("*").single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateProvider(id: string, input: AIProviderUpdate): Promise<AIProvider> {
  const updates: Record<string, unknown> = {};
  if (input.label !== undefined) updates.label = input.label;
  if (input.model !== undefined) updates.model = input.model;
  if (input.isEnabled !== undefined) updates.is_enabled = input.isEnabled;
  if (input.priority !== undefined) updates.priority = input.priority;

  const { data, error } = await db.from("ai_providers").update(updates).eq("id", id).select("*").single();
  if (error) throw error;
  return mapRow(data);
}

export async function deleteProvider(id: string): Promise<void> {
  const { error } = await db.from("ai_providers").delete().eq("id", id);
  if (error) throw error;
}

export async function updateProviderPriorities(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.from("ai_providers").update({ priority: i + 1 }).eq("id", orderedIds[i]);
  }
}

/**
 * Recent AI calls, for the health board. Written by the `ai-fill` Edge Function,
 * read here. `prompt_hash` is a fingerprint, never the text.
 */
export async function getRecentLogs(limit = 20): Promise<AIRequestLog[]> {
  const { data, error } = await db.from("ai_request_logs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapLogRow);
}
