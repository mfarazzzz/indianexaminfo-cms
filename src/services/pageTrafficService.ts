/**
 * pageTrafficService.ts — writes the Search Console page metrics into
 * page_traffic (promoted migration 20260928042556).
 *
 * Gate: manage_settings (app-layer pre-check via assertPermission; the table's
 * RLS INSERT/UPDATE policies are the authoritative gate — both require
 * manage_settings, and there is NO delete policy, so the API can never delete
 * traffic rows). The upload runs as the signed-in user, not the service role.
 *
 * The page_traffic PK is (url, period_start, period_end): re-importing the
 * same period refreshes the numbers (upsert), while different periods stack.
 * Rows are chunked so one 300-page export doesn't build an enormous request.
 */
import { db } from '@/lib/supabase/client';
import { assertPermission } from '@/lib/auth/permissionGuard';
import { P } from '@/config/permissions';
import type { GscPageRow } from '@/lib/gscCsv';

const CHUNK_SIZE = 250;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ImportResult {
  upserted: number;
  periodStart: string;
  periodEnd: string;
}

/**
 * Upsert parsed GSC page rows for one reporting period the owner entered.
 * Throws on a bad period or a denied permission (RLS denial surfaces as error).
 */
export async function importPageTraffic(
  rows: GscPageRow[],
  periodStart: string,
  periodEnd: string,
): Promise<ImportResult> {
  assertPermission(P.MANAGE_SETTINGS, 'import Search Console traffic');

  if (!DATE_RE.test(periodStart) || !DATE_RE.test(periodEnd)) {
    throw new Error('Period must be two ISO dates (YYYY-MM-DD).');
  }
  if (periodStart > periodEnd) {
    throw new Error('Period start must be on or before period end.');
  }
  if (rows.length === 0) {
    throw new Error('Nothing to import — the CSV had no valid data rows.');
  }

  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE).map((r) => ({
      url: r.url,
      clicks: r.clicks,
      impressions: r.impressions,
      period_start: periodStart,
      period_end: periodEnd,
      source: 'search-console',
      loaded_at: new Date().toISOString(),
    }));
    const { error } = await db
      .from('page_traffic')
      .upsert(chunk, { onConflict: 'url,period_start,period_end' });
    if (error) throw error;
    upserted += chunk.length;
  }

  return { upserted, periodStart, periodEnd };
}

/** Latest-loaded period for the UI hint (readable by any editor per RLS). */
export async function getLatestTrafficPeriod(): Promise<{ periodStart: string; periodEnd: string; pages: number } | null> {
  const { data, error } = await db
    .from('page_traffic')
    .select('period_start,period_end')
    .order('period_end', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  const { count } = await db
    .from('page_traffic')
    .select('*', { count: 'exact', head: true })
    .eq('period_start', row.period_start)
    .eq('period_end', row.period_end);
  return { periodStart: row.period_start, periodEnd: row.period_end, pages: count ?? 0 };
}
