/**
 * noticeResult.ts — S2.15 the ONE notice result the editor and the golden share.
 *
 * It layers the deterministic date-line extraction (noticeDateLines) UNDER the
 * model answer (postProcessExtraction), so a flaky / low-yield model can never
 * silently drop an "Important Dates" line the paste clearly carried. A
 * deterministic row wins over a model row on the same date + VIEW type; the
 * model still owns identity/classification fields and any date the paste did not
 * spell out as a "Label: date" line. This is the reliability guarantee the owner
 * asked for: extraction does not depend on a flaky free model.
 */
import { postProcessExtraction, type PipelineResult } from "./noticePipeline";
import type { AllowedOptions } from "./extractionContract";
import { extractNoticeDateLines, mergeNoticeRows } from "./noticeDateLines";
import { detectHowToSteps } from "./noticeSteps";

export function buildNoticeResult(
  parsed: Record<string, unknown>,
  opts: AllowedOptions,
  sourceText: string,
  year: number,
  currentSelectionModel?: string | null,
  sourceLinks?: { label: string; url: string }[],
): PipelineResult {
  const base = postProcessExtraction(parsed, opts, sourceText, year, currentSelectionModel, sourceLinks);
  const det = extractNoticeDateLines(sourceText, year, currentSelectionModel ?? null);

  const rows = mergeNoticeRows(base.rows, det.rows);

  const seen = new Set((base.notes ?? []).map((n) => n.text));
  const notes = [...(base.notes ?? []), ...det.notes.filter((n) => !seen.has(n.text))];

  // B2 (client): the deterministic how-to detector reads the pasted text directly,
  // so a flaky/low-yield model cannot drop the "How to download / apply" steps the
  // notice clearly carried. Absent when there is no how-to block, keeping every
  // pre-existing result byte-identical. The editor authors these; never auto-applied.
  const steps = detectHowToSteps(sourceText);

  return {
    ...base,
    rows,
    ...(notes.length ? { notes } : {}),
    ...(det.conflicts.length ? { dateConflicts: det.conflicts } : {}),
    ...(steps.length ? { steps } : {}),
  };
}
