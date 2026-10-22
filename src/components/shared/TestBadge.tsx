/**
 * TestBadge — the unmistakable "TEST" chip an editor sees on any reference TEST
 * row in a list, so a seeded sample can never be mistaken for real content.
 * Driven by the shared isTestSlug rule (src/lib/testContent).
 */
import { isTestSlug } from "@/lib/testContent";

export function TestBadge({ slug }: { slug: string | null | undefined }) {
  if (!isTestSlug(slug)) return null;
  return (
    <span
      data-testid="test-badge"
      title="Reference TEST record — sample data, not real information"
      className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-dashed border-amber-500 bg-amber-50 text-amber-700"
    >
      TEST
    </span>
  );
}
