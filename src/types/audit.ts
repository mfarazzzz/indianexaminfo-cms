import type { Json } from "@/lib/supabase/types";

export type AuditLog = {
  id: string;
  userId: string | null;
  userName: string;
  userRole: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  details: Json;
  ipAddress: string | null;
  createdAt: string;
};
