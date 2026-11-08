/**
 * jobPostingGaps.ts — owner batch 9, H2. "What was NOT found" under the Quick add proposals.
 *
 * THE PROBLEM. The extractor reported 3 of 8 fields on a live notice and said nothing about the
 * other five. The editor therefore had no way to tell "the notice does not contain a last date"
 * from "I have not looked for the last date yet" — and the five facts that actually decide
 * whether the page earns a JobPosting were the ones nobody was told about.
 *
 * THE SOURCE OF TRUTH IS THE CHECKLIST ITSELF. This module does not keep its own list of
 * required facts: it walks JOBPOSTING_GATES, the same constant the bulk-fill report and its test
 * use ("names exactly the five conditions JobPosting needs, in fill order"). Add a gate there
 * and it appears here; the two cannot drift.
 *
 * WHAT IT WILL NOT DO. It never guesses a value and never narrows a gap because something
 * *might* be derivable. A gate is either satisfied by a proposal the extractor actually made, or
 * it is listed. Two of the five gates can never come from the notice TEXT at all — the official
 * notification URL is the notice's own address, and verification is an editorial act on the
 * row — so they are listed with the action that satisfies them instead of an empty shrug.
 */
import { JOBPOSTING_GATES } from "@/lib/utils/vacancyBulkOps";
import type { VacancyFieldKey, VacancyProposal } from "./vacancyNoticeFields";

/**
 * gate column → the extractor field that satisfies it. A column absent from this map cannot be
 * read out of the notice text by ANY extractor, and the hint below says what to do instead.
 */
const GATE_FIELD: Record<string, VacancyFieldKey> = {
  notification_date: "notificationDate",
  application_start_date: "applicationStartDate",
  application_end_date: "applicationEndDate",
};

/**
 * What to look for in a Hindi/English notice, per gate. The labels are the ones the owner named
 * in batch 9 (H1): a real UP/MP notice mixes both scripts on the same line, so the editor is
 * told both spellings rather than an English-only phrase that is not on the page.
 */
const HUNT_HINT: Record<string, string> = {
  notification_date:
    "look for विज्ञापन तिथि / विज्ञापन दिनांक / Date of notification — usually the first date in the notice.",
  application_start_date:
    "look for ऑनलाइन आवेदन प्रारंभ / आवेदन प्रारंभ तिथि / Online application starts.",
  application_end_date:
    "look for अंतिम तिथि / आवेदन की अंतिम तिथि / Last date to apply — the date the window closes, not the exam date.",
  official_notification_url:
    "not in the text: paste the link of the notice file itself in step 1 (the checklist will not verify the row without it).",
  __verified__:
    "not in the text: open that notice, check the row against it, then use Save + verify.",
};

export interface JobPostingGap {
  /** The checklist column that is still empty. */
  column: string;
  /** The checklist label, verbatim from JOBPOSTING_GATES. */
  label: string;
  /** What to look for in the notice, or the action that satisfies a non-text gate. */
  hint: string;
  /** False for the two gates no notice TEXT can ever supply. */
  fromText: boolean;
}

/**
 * The JobPosting checklist entries that no proposal covers, in checklist order.
 *
 * An empty array means every gate the text could satisfy was found — it does NOT mean the row is
 * ready: the two non-text gates are part of the list, so a complete text still returns two
 * entries telling the editor to add the official link and verify.
 */
export function jobPostingGaps(
  proposals: readonly Pick<VacancyProposal, "field">[],
): JobPostingGap[] {
  const found = new Set(proposals.map((p) => p.field));
  const gaps: JobPostingGap[] = [];
  for (const gate of JOBPOSTING_GATES) {
    const field = GATE_FIELD[gate.column] as VacancyFieldKey | undefined;
    const fromText = field !== undefined;
    if (field && found.has(field)) continue;
    gaps.push({
      column: gate.column,
      label: gate.label,
      hint: HUNT_HINT[gate.column] ?? "",
      fromText,
    });
  }
  return gaps;
}
