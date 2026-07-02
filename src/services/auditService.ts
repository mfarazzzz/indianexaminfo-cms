import { db } from "@/lib/supabase/client";
import type { AuditLog } from "@/types/audit";

function mapRow(row: any): AuditLog {
  return {
    id: row.id, userId: row.user_id, userName: row.user_name, userRole: row.user_role,
    action: row.action, entityType: row.entity_type, entityId: row.entity_id,
    entityName: row.entity_name, details: row.details, ipAddress: row.ip_address,
    createdAt: row.created_at,
  };
}

export async function getAuditLogs(opts?: {
  userId?: string; entityType?: string; action?: string;
  dateFrom?: string; dateTo?: string; limit?: number; offset?: number;
}): Promise<{ data: AuditLog[]; count: number }> {
  let q = db.from("audit_log").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (opts?.userId) q = q.eq("user_id", opts.userId);
  if (opts?.entityType) q = q.eq("entity_type", opts.entityType);
  if (opts?.action) q = q.eq("action", opts.action);
  if (opts?.dateFrom) q = q.gte("created_at", opts.dateFrom);
  if (opts?.dateTo) q = q.lte("created_at", opts.dateTo);
  if (opts?.limit) q = q.limit(opts.limit);
  if (opts?.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { data: (data ?? []).map(mapRow), count: count ?? 0 };
}

export async function logAction(entry: {
  userId?: string; userName: string; userRole: string; action: string;
  entityType?: string; entityId?: string; entityName?: string; details?: unknown;
}): Promise<void> {
  await db.from("audit_log").insert({
    user_id: entry.userId ?? null, user_name: entry.userName, user_role: entry.userRole,
    action: entry.action, entity_type: entry.entityType ?? null, entity_id: entry.entityId ?? null,
    entity_name: entry.entityName ?? null, details: entry.details ?? {},
  });
}
