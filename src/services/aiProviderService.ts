/**
 * aiProviderService.ts — CRUD for ai_providers table + request logging.
 */
import { db } from "@/lib/supabase/client";
import type { AIProvider, AIProviderInsert, AIProviderUpdate, AIRequestLog } from "@/types/aiProvider";

function mapRow(row: any): AIProvider {
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

function mapLogRow(row: any): AIRequestLog {
  return {
    id: row.id,
    providerId: row.provider_id,
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

export async function getEnabledProviders(): Promise<AIProvider[]> {
  const { data, error } = await db.from("ai_providers").select("*").eq("is_enabled", true).order("priority");
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function createProvider(input: AIProviderInsert): Promise<AIProvider> {
  const { data, error } = await db.from("ai_providers").insert({
    provider: input.provider,
    label: input.label,
    api_key: input.apiKey,
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
  if (input.apiKey !== undefined) updates.api_key = input.apiKey;
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

export async function recordProviderSuccess(id: string): Promise<void> {
  await db.rpc("increment_usage", { provider_id: id }).catch(() => {
    // Fallback if RPC not available
    db.from("ai_providers").update({ last_used_at: new Date().toISOString(), last_error: null, usage_count: db.raw ? undefined : 0 }).eq("id", id).then(() => {});
  });
  // Simple update without RPC
  await db.from("ai_providers").update({ last_used_at: new Date().toISOString(), last_error: null }).eq("id", id).catch(() => {});
}

export async function recordProviderError(id: string, error: string): Promise<void> {
  await db.from("ai_providers").update({ last_error: error }).eq("id", id).catch(() => {});
}

export async function insertRequestLog(log: { providerId: string | null; promptHash: string; status: string; errorMessage: string | null; latencyMs: number; consumerName: string }): Promise<void> {
  await db.from("ai_request_logs").insert({
    provider_id: log.providerId,
    prompt_hash: log.promptHash,
    status: log.status,
    error_message: log.errorMessage,
    latency_ms: log.latencyMs,
    consumer_name: log.consumerName,
  }).catch(() => {}); // Fire-and-forget
}

export async function getRecentLogs(limit = 20): Promise<AIRequestLog[]> {
  const { data, error } = await db.from("ai_request_logs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapLogRow);
}

export async function getDashboardStats(): Promise<{ totalRequests: number; enabledKeys: number }> {
  const providers = await getAllProviders();
  const totalRequests = providers.reduce((sum, p) => sum + p.usageCount, 0);
  const enabledKeys = providers.filter((p) => p.isEnabled).length;
  return { totalRequests, enabledKeys };
}
