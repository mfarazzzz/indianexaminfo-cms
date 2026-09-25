/**
 * regionService.ts — reads the `regions` controlled vocabulary.
 *
 * `regions` is the single source of truth for exams.region (FK). The exam
 * editor's region picker is sourced from here so an editor can only choose a
 * real state / union territory / all-india — never free-text that drifts.
 */
import { db } from "@/lib/supabase/client";

export type RegionKind = "state" | "ut" | "national";

export type Region = {
  slug: string;
  label: string;
  kind: RegionKind;
};

function mapRow(row: Record<string, unknown>): Region {
  return {
    slug: row.slug as string,
    label: row.label as string,
    kind: row.kind as RegionKind,
  };
}

/**
 * All regions, ordered for a picker: All India first, then states A–Z, then
 * union territories A–Z. Returns [] on error (the picker then shows no options,
 * which — with a required field — blocks save rather than saving a wrong value).
 */
export async function getRegions(): Promise<Region[]> {
  const { data, error } = await db
    .from("regions")
    .select("slug,label,kind")
    .order("label", { ascending: true });
  if (error) {
    console.error("[regionService] getRegions failed:", error);
    return [];
  }
  const rows: Region[] = ((data ?? []) as Record<string, unknown>[]).map((r) => mapRow(r));
  const rank = (k: RegionKind) => (k === "national" ? 0 : k === "state" ? 1 : 2);
  return rows.sort((a: Region, b: Region) => rank(a.kind) - rank(b.kind) || a.label.localeCompare(b.label));
}
