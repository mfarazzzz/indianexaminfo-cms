// FaqAnswerWarning — non-blocking CMS FAQ-editor hint (owner decision, Sprint 0
// Part 2 2026-09-28). When an answer CONTAINS one of the no-fact phrases
// ("not specified", "not available", "to be announced") the editor shows an
// amber note under the answer box: "This answer gives the reader no fact. Add
// the fact or remove the question." It never blocks saving.
//
// This is deliberately BROADER than the site-side hiding rule
// (lib/sectionRegistry.ts meaningfulFaqs, which hides only a bare placeholder
// TOKEN alone). The editor warns about sentences too, so authors notice weak
// answers; the public site still shows them until the content is fixed.
import { useWatch, type Control } from "react-hook-form";

const NO_FACT_PHRASES = ["not specified", "not available", "to be announced"];

/** Pure rule, exported for tests. Returns the warning text or null. */
export function faqAnswerWarning(answer: string | null | undefined): string | null {
  const norm = (answer ?? "").trim().toLowerCase();
  if (norm.length === 0) return null; // empty answers have their own required-ness elsewhere
  if (NO_FACT_PHRASES.some((p) => norm.includes(p))) {
    return "This answer gives the reader no fact. Add the fact or remove the question.";
  }
  return null;
}

/**
 * Renders nothing unless the watched answer matches. `control` is the form's
 * react-hook-form control; `name` is the field path, e.g. `faqs.0.answer`.
 */
export function FaqAnswerWarning({
  control,
  name,
}: {
  // `any` mirrors the editors' existing `form: any` style — Control<T> is
  // invariant in T (via _options.validate), so a typed Control prop would
  // reject each page's concrete form type at the call sites.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  name: string;
}) {
  const answer = useWatch({ control: control as Control<any>, name });
  const warning = faqAnswerWarning(typeof answer === "string" ? answer : null);
  if (warning === null) return null;
  return (
    <p role="note" className="text-xs font-medium text-amber-700">
      &#9888; {warning}
    </p>
  );
}
