/**
 * noticeSteps.ts — B2 (client half): a DETERMINISTIC "How to …" steps detector,
 * the same idea as noticeDateLines — it reads the pasted notice directly so a
 * flaky model cannot drop the how-to-download / how-to-apply instructions.
 *
 * It finds a "How to …" heading and the consecutive instruction lines under it,
 * classifies the target module by the heading (admit card → admit-card; apply →
 * application-process), and pulls a separate `carry` list when a "documents to
 * carry / bring" line appears. Every step keeps its verbatim source line so the
 * editor can verify it; nothing is auto-applied.
 *
 * The MODEL path (paraphrased steps from the template) is validated with
 * stepNounsInSource(): a paraphrased step is kept only when the concrete nouns
 * it uses (registration number, date of birth, portal, …) actually occur in the
 * source — an invented step is dropped. The deterministic detector's own steps
 * are source lines, so they are attested by construction.
 */

export interface StepDraft { text: string; sourceQuote: string }
export interface DetectedSteps {
  module: "admit-card" | "application-process";
  heading: string;
  steps: StepDraft[];
  carry: StepDraft[];
}

const HOWTO_HEADING = /^\s*(?:how\s+to|steps?\s+to|procedure\s+to|process\s+to|way\s+to|steps\s+for)\b/i;
const CARRY_LINE = /\bcarry\b|\bbring\b|documents?\s+(?:to|required)|what\s+to\s+(?:carry|bring)|following\s+documents|valid\s+(?:photo\s*)?id\b/i;
// A line that clearly ends the how-to block (a new section, not another step).
const BLOCK_END = /^\s*(?:some\s+useful|important\s+links|trending|related|notes?\b|faqs?\b|eligibility|vacancy|application\s+fee|categor|copyright|get\s+instant|follow\b)/i;
// A step is a short imperative line; a long prose paragraph or a nav label is not.
const TOO_LONG = (s: string) => s.length > 180;

/** Which module the how-to block belongs to (D3: admit-card vs application-process). */
function moduleFor(heading: string): DetectedSteps["module"] {
  return /admit\s*card|hall\s*ticket|call\s*letter|download/i.test(heading) ? "admit-card" : "application-process";
}

/**
 * Detect every "How to …" block in the pasted notice. Returns one entry per
 * heading, with its ordered steps and any carry lines, each carrying its source
 * line. Empty when the notice has no how-to section.
 */
export function detectHowToSteps(sourceText: string): DetectedSteps[] {
  const lines = sourceText.replace(/\r\n/g, "\n").split("\n");
  const out: DetectedSteps[] = [];
  let i = 0;
  while (i < lines.length) {
    const heading = lines[i].trim();
    if (!HOWTO_HEADING.test(heading)) { i++; continue; }

    const block: DetectedSteps = { module: moduleFor(heading), heading, steps: [], carry: [] };
    let collectingCarry = false;
    for (let j = i + 1; j < lines.length; j++) {
      const raw = lines[j];
      const line = raw.trim();
      if (!line) { if (block.steps.length || block.carry.length) break; else continue; }
      if (HOWTO_HEADING.test(line) || BLOCK_END.test(line)) break;
      const isCarryHeader = CARRY_LINE.test(line) && /documents?\b|carry\b|bring\b/i.test(line) && line.length < 80;
      if (isCarryHeader) { collectingCarry = true; }
      const draft: StepDraft = { text: line.replace(/^\d+[.)]\s*/, "").replace(/^[-•*]\s*/, "").trim(), sourceQuote: line };
      if (!draft.text || TOO_LONG(draft.text)) continue;
      if (collectingCarry) block.carry.push(draft);
      else block.steps.push(draft);
    }
    if (block.steps.length > 0 || block.carry.length > 0) out.push(block);
    i += 1;
  }
  return out;
}

/** Concrete nouns a paraphrased step may legitimately reference. */
const CONCRETE_NOUNS = /registration\s*number|application\s*number|roll\s*no(?:\.?\s*number)?|date\s*of\s*birth|\bdob\b|admit\s*card|hall\s*ticket|call\s*letter|official\s*(?:website|site|portal)|\bportal\b|verification\s*code|\bcaptcha\b|sign\s*in|log\s*in|password|\botp\b|photo\s*id|photograph|passport\s*size|printout|gender|\bmobile\b|\bemail\b|name\s*and\s*(?:father|parent)/gi;

/**
 * Validate a MODEL-paraphrased step against the source: every concrete noun it
 * uses must appear in the source text (case-insensitive). A step with no
 * concrete nouns is allowed (the editor still verifies it); a step that invents
 * a field the notice never mentions is dropped.
 */
export function stepNounsInSource(stepText: string, sourceText: string): boolean {
  const src = sourceText.toLowerCase();
  const found = stepText.match(CONCRETE_NOUNS) ?? [];
  if (found.length === 0) return true;
  return found.every((n) => src.includes(n.toLowerCase()));
}

/** Keep only model steps whose concrete nouns are attested in the source. */
export function filterModelSteps(steps: StepDraft[], sourceText: string): StepDraft[] {
  return (steps ?? []).filter((s) => s && s.text && stepNounsInSource(s.text, sourceText));
}
