/**
 * VacancyQuickAddPage — "Quick add from notice" (owner batch 8, H1).
 *
 * THE FLOW: paste the notice → the DETERMINISTIC extractors propose the fields →
 * the editor accepts or edits each one → the row is created as a DRAFT.
 *
 * THE RULES THIS PAGE KEEPS:
 *   • Accept writes to the FORM ONLY. Nothing reaches the database until the
 *     editor presses "Create draft", and that creates a DRAFT — never a published
 *     page. (Publishing is a separate, permissioned act: the edit page.)
 *   • NO URL IS FETCHED. The notice text is pasted by the editor; this page never
 *     opens the official URL, never calls a scanner, never OCRs anything. The only
 *     network calls are the CMS's own reads (regions, duplicate check) and the one
 *     insert.
 *   • EVERY PROPOSAL SHOWS ITS SOURCE LINE, so the editor checks the fact against
 *     the notice instead of trusting the extractor.
 *   • THE COPY GUARD STAYS. A proposal the guard refused cannot be accepted — the
 *     editor has to write the value in their own words.
 *   • NO NEAR-DUPLICATE. Before creating, the title and slug are checked against
 *     the 361 existing vacancies; a hit is shown as a LINK to the existing row
 *     instead of a second copy of the same notice.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Wand2, Save, Check, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getRegions, type Region } from "@/services/regionService";
import {
  createSarkariNaukri,
  findVacancyDuplicates,
  type VacancyDuplicateHit,
} from "@/services/sarkariNaukriService";
import {
  extractVacancyFields,
  type VacancyExtraction,
  type VacancyProposal,
} from "@/lib/vacancy/vacancyNoticeFields";
import { proposeVacancySlug } from "@/lib/vacancy/vacancySlug";
import { getErrorMessage } from "@/lib/utils";

interface QuickAddForm {
  title: string;
  slug: string;
  organization: string;
  state: string;
  category: string;
  recruitmentType: "exam" | "direct";
  notificationDate: string;
  applicationStartDate: string;
  applicationEndDate: string;
  vacancyCount: string;
  applicationFee: Record<string, string> | null;
  ageLimit: string;
  officialNotificationUrl: string;
  applicationUrl: string;
}

const EMPTY_FORM: QuickAddForm = {
  title: "",
  slug: "",
  organization: "",
  state: "",
  category: "",
  recruitmentType: "direct",
  notificationDate: "",
  applicationStartDate: "",
  applicationEndDate: "",
  vacancyCount: "",
  applicationFee: null,
  ageLimit: "",
  officialNotificationUrl: "",
  applicationUrl: "",
};

/** The guard's verdict, in words the editor can act on. */
function guardLabel(p: VacancyProposal): { text: string; tone: string } {
  switch (p.guard) {
    case "data":
      return { text: "facts — no wording copied", tone: "text-slate-400" };
    case "name-exempt":
      return { text: "a name — exempt from the copy guard", tone: "text-slate-400" };
    case "passed":
      return { text: "copy guard passed", tone: "text-green-600" };
    default:
      return { text: "refused by the copy guard", tone: "text-red-600" };
  }
}

export function VacancyQuickAddPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [regions, setRegions] = useState<Region[]>([]);
  const [noticeText, setNoticeText] = useState("");
  // The two URL inputs in step 1 ARE the form fields — they are not a second
  // copy of them. Before this was fixed they wrote to local state that never
  // reached the form, so the editor had to type the same two URLs a second
  // time in step 3, and a row created without them could never pass the
  // JobPosting checklist (the official notification link is required before
  // the database will verify a vacancy).
  const [extraction, setExtraction] = useState<VacancyExtraction | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [form, setForm] = useState<QuickAddForm>(EMPTY_FORM);
  const [duplicates, setDuplicates] = useState<VacancyDuplicateHit[]>([]);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getRegions().then(setRegions).catch(() => setRegions([]));
  }, []);

  const stateLabel = useMemo(
    () => regions.find((r) => r.slug === form.state)?.label ?? "",
    [regions, form.state],
  );

  const set = <K extends keyof QuickAddForm>(key: K, value: QuickAddForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ── The extractor ──────────────────────────────────────────────────────────
  const handleExtract = () => {
    if (!noticeText.trim()) {
      toast.error("Paste the notice text first.");
      return;
    }
    const year = Number(form.notificationDate?.slice(0, 4)) || new Date().getFullYear();
    const result = extractVacancyFields(noticeText, { year });
    setExtraction(result);
    setAccepted({});
    if (result.proposals.length === 0) {
      toast.warning("Nothing could be read from that text — fill the form by hand.");
    } else {
      toast.success(`${result.proposals.length} field(s) found. Check each one against the notice.`);
    }
  };

  // ── Accept / edit a proposal (FORM ONLY) ───────────────────────────────────
  const acceptProposal = (p: VacancyProposal) => {
    if (p.value === null || p.guard === "refused") return;
    switch (p.field) {
      case "title": set("title", String(p.value)); break;
      case "organization": set("organization", String(p.value)); break;
      case "notificationDate": set("notificationDate", String(p.value)); break;
      case "applicationStartDate": set("applicationStartDate", String(p.value)); break;
      case "applicationEndDate": set("applicationEndDate", String(p.value)); break;
      case "vacancyCount": set("vacancyCount", String(p.value)); break;
      case "applicationFee": set("applicationFee", p.value as Record<string, string>); break;
      case "ageLimit": set("ageLimit", String(p.value)); break;
    }
    setAccepted((prev) => ({ ...prev, [p.field]: true }));
    setEditing(null);
  };

  const startEdit = (p: VacancyProposal) => {
    setEditing(p.field);
    const current =
      p.field === "applicationFee"
        ? Object.entries((form.applicationFee ?? {}) as Record<string, string>)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : String(
            (form as unknown as Record<string, unknown>)[p.field] ??
              (typeof p.value === "string" || typeof p.value === "number" ? p.value : ""),
          );
    setDraftValue(current);
  };

  const commitEdit = (p: VacancyProposal) => {
    const value = draftValue.trim();
    if (!value) return;
    switch (p.field) {
      case "title": set("title", value); break;
      case "organization": set("organization", value); break;
      case "notificationDate": set("notificationDate", value); break;
      case "applicationStartDate": set("applicationStartDate", value); break;
      case "applicationEndDate": set("applicationEndDate", value); break;
      case "vacancyCount": set("vacancyCount", value.replace(/[^0-9]/g, "")); break;
      case "applicationFee": {
        const map: Record<string, string> = {};
        for (const part of value.split(",")) {
          const [k, ...rest] = part.split(":");
          const amount = rest.join(":").trim();
          const key = (k ?? "").trim();
          if (key && amount) map[key] = amount;
        }
        set("applicationFee", Object.keys(map).length ? map : null);
        break;
      }
      case "ageLimit": set("ageLimit", value); break;
    }
    setAccepted((prev) => ({ ...prev, [p.field]: true }));
    setEditing(null);
  };

  // ── The slug ───────────────────────────────────────────────────────────────
  const handleProposeSlug = () => {
    if (!form.title.trim()) {
      toast.error("A title is needed before a slug can be proposed.");
      return;
    }
    const year = Number(form.notificationDate?.slice(0, 4)) || new Date().getFullYear();
    const slug = proposeVacancySlug({
      title: form.title,
      state: form.state,
      stateLabel,
      year,
    });
    if (!slug) {
      toast.error("That title does not produce a slug — write the slug by hand.");
      return;
    }
    set("slug", slug);
  };

  // ── The duplicate check ────────────────────────────────────────────────────
  const runDuplicateCheck = useCallback(async () => {
    if (!form.title.trim() && !form.slug.trim()) {
      setDuplicates([]);
      return;
    }
    setChecking(true);
    try {
      setDuplicates(await findVacancyDuplicates(form.slug, form.title));
    } catch {
      setDuplicates([]);
    } finally {
      setChecking(false);
    }
  }, [form.slug, form.title]);

  useEffect(() => {
    const t = setTimeout(() => { void runDuplicateCheck(); }, 700);
    return () => clearTimeout(t);
  }, [runDuplicateCheck]);

  // ── Create (DRAFT ONLY) ────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (!form.slug.trim()) { toast.error("Slug is required"); return; }
    if (!form.organization.trim()) { toast.error("Organization is required"); return; }
    if (!form.state.trim()) { toast.error("State is required — choose All India for a national vacancy"); return; }
    if (form.applicationStartDate && form.applicationEndDate && form.applicationStartDate > form.applicationEndDate) {
      toast.error("Application start date must be on or before the end date"); return;
    }
    if (form.vacancyCount && !/^\d+$/.test(form.vacancyCount)) {
      toast.error("The post count must be a whole number"); return;
    }

    // The duplicate gate: never create a second copy of a notice we already have.
    const hits = await findVacancyDuplicates(form.slug, form.title);
    if (hits.length > 0) {
      setDuplicates(hits);
      toast.error("This notice is already in the table — open the existing row instead.");
      return;
    }

    setCreating(true);
    try {
      const created = await createSarkariNaukri({
        slug: form.slug.trim(),
        title: form.title.trim(),
        organization: form.organization.trim(),
        state: form.state.trim(),
        category: form.category.trim() || null,
        recruitmentType: form.recruitmentType,
        notificationDate: form.notificationDate || null,
        applicationStartDate: form.applicationStartDate || null,
        applicationEndDate: form.applicationEndDate || null,
        vacancyCount: form.vacancyCount ? Number(form.vacancyCount) : null,
        applicationFee: form.applicationFee,
        ageLimit: form.ageLimit || null,
        officialNotificationUrl: form.officialNotificationUrl || null,
        applicationUrl: form.applicationUrl || null,
        // A DRAFT — always. Publishing happens on the edit page, under publish_post.
        workflowStatus: "draft",
        createdBy: user?.id ?? null,
      });
      toast.success("Draft created. Fill the rest and publish when it is checked.");
      navigate(`/vacancies/${created.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const proposals = extraction?.proposals ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/vacancies")} className="rounded p-1 hover:bg-slate-100">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Quick add from notice</h1>
            <p className="text-xs text-slate-500">
              Paste the notice, check what was found, create a draft. Nothing is published here.
            </p>
          </div>
        </div>
      </div>

      {/* ── Step 1: the notice ────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">1 — The notice</h2>
        <p className="text-xs text-slate-500">
          Paste the text of the notice (the "Important Dates" block, the post count, the fee and the
          age limit). Nothing is fetched: this page never opens the official site, never scans a PDF
          and never reads a URL you paste below — it only reads the text you paste here.
        </p>
        <textarea
          value={noticeText}
          onChange={(e) => setNoticeText(e.target.value)}
          rows={12}
          data-testid="quick-add-notice"
          placeholder={"Uttar Pradesh Police Constable Recruitment 2026\n\nImportant Dates:\nNotification Date: 12.08.2026\nOnline Application Starts: 20.08.2026\nLast Date to Apply: 15.09.2026\n\nTotal No. of Posts: 5,244"}
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono text-xs"
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="quick-official-url" className="mb-1 block text-xs font-medium text-slate-600">
              Official notification URL
            </label>
            <input id="quick-official-url" value={form.officialNotificationUrl}
              onChange={(e) => set("officialNotificationUrl", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="https://…gov.in/…notice.pdf" />
            <p className="mt-0.5 text-[11px] text-slate-400">Required before this row can be verified.</p>
          </div>
          <div>
            <label htmlFor="quick-apply-url" className="mb-1 block text-xs font-medium text-slate-600">
              Application URL
            </label>
            <input id="quick-apply-url" value={form.applicationUrl}
              onChange={(e) => set("applicationUrl", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="https://…" />
            <p className="mt-0.5 text-[11px] text-slate-400">Where the reader applies.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExtract}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Wand2 size={15} /> Extract the fields
        </button>
      </div>

      {/* ── Step 2: the proposals ─────────────────────────────────────────── */}
      {extraction && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">2 — What was found (check each one)</h2>
          {proposals.length === 0 ? (
            <p className="text-xs text-amber-700">Nothing could be read from that text. Fill the form below by hand.</p>
          ) : (
            <ul className="space-y-2" data-testid="quick-add-proposals">
              {proposals.map((p) => {
                const guard = guardLabel(p);
                const refused = p.guard === "refused";
                return (
                  <li key={p.field} className="rounded border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-700">{p.label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] ${guard.tone}`}>{guard.text}</span>
                        {accepted[p.field] && !refused && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-green-700">
                            <Check size={12} /> in the form
                          </span>
                        )}
                        {!refused && (
                          <button type="button" onClick={() => acceptProposal(p)}
                            className="rounded border border-blue-200 px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-50">
                            Accept
                          </button>
                        )}
                        {!refused && editing !== p.field && (
                          <button type="button" onClick={() => startEdit(p)}
                            className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                    {editing === p.field ? (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm"
                        />
                        <button type="button" onClick={() => commitEdit(p)}
                          className="rounded bg-blue-600 px-2 py-1 text-[11px] text-white">Use this</button>
                        <button type="button" onClick={() => setEditing(null)}
                          className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600">Cancel</button>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-slate-900">{refused ? "—" : p.display}</p>
                    )}
                    {refused && p.refused && (
                      <p className="mt-1 text-[11px] text-red-600">{p.refused}</p>
                    )}
                    {p.sourceLine && (
                      <p className="mt-1 border-l-2 border-slate-200 pl-2 font-mono text-[11px] text-slate-500">
                        source: {p.sourceLine}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {extraction.notes.length > 0 && (
            <ul className="list-disc pl-5 text-[11px] text-slate-500">
              {extraction.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          {extraction.conflicts.length > 0 && (
            <ul className="list-disc pl-5 text-[11px] text-amber-700">
              {extraction.conflicts.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* ── Step 3: the row ──────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">3 — The row (everything is editable)</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="quick-title" className="mb-1 block text-xs font-medium text-slate-600">Title *</label>
            <input id="quick-title" value={form.title} onChange={(e) => set("title", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. UP Anganwadi Recruitment 2026 Meerut Division" />
          </div>
          <div>
            <label htmlFor="quick-slug" className="mb-1 block text-xs font-medium text-slate-600">Slug *</label>
            <div className="flex gap-2">
              <input id="quick-slug" value={form.slug} onChange={(e) => set("slug", e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono text-xs" />
              <button type="button" onClick={handleProposeSlug}
                className="shrink-0 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">
                Propose
              </button>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Proposed in the pattern the live rows use: state-token, subject, year.
            </p>
          </div>
          <div>
            <label htmlFor="quick-org" className="mb-1 block text-xs font-medium text-slate-600">Organization *</label>
            <input id="quick-org" value={form.organization} onChange={(e) => set("organization", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. WCD UP / ICDS Meerut" />
          </div>
          <div>
            <label htmlFor="quick-state" className="mb-1 block text-xs font-medium text-slate-600">State *</label>
            <select id="quick-state" value={form.state} onChange={(e) => set("state", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Select —</option>
              {regions.filter((r) => r.kind === "national").map((r) => (
                <option key={r.slug} value={r.slug}>{r.label}</option>
              ))}
              {regions.some((r) => r.kind === "state") && (
                <optgroup label="States">
                  {regions.filter((r) => r.kind === "state").map((r) => (
                    <option key={r.slug} value={r.slug}>{r.label}</option>
                  ))}
                </optgroup>
              )}
              {regions.some((r) => r.kind === "ut") && (
                <optgroup label="Union Territories">
                  {regions.filter((r) => r.kind === "ut").map((r) => (
                    <option key={r.slug} value={r.slug}>{r.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label htmlFor="quick-category" className="mb-1 block text-xs font-medium text-slate-600">Category</label>
            <input id="quick-category" value={form.category} onChange={(e) => set("category", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. anganwadi, driver, hospital" />
          </div>
          <div>
            <label htmlFor="quick-type" className="mb-1 block text-xs font-medium text-slate-600">Recruitment type</label>
            <select id="quick-type" value={form.recruitmentType} onChange={(e) => set("recruitmentType", e.target.value as "exam" | "direct")}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm">
              <option value="direct">Sarkari Bharti (walk-in / merit / direct)</option>
              <option value="exam">Sarkari Exam (competitive)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="quick-notification-date" className="mb-1 block text-xs font-medium text-slate-600">Notification date</label>
            <input id="quick-notification-date" type="date" value={form.notificationDate}
              onChange={(e) => set("notificationDate", e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="quick-start" className="mb-1 block text-xs font-medium text-slate-600">Application start</label>
            <input id="quick-start" type="date" value={form.applicationStartDate}
              onChange={(e) => set("applicationStartDate", e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="quick-end" className="mb-1 block text-xs font-medium text-slate-600">Last date to apply</label>
            <input id="quick-end" type="date" value={form.applicationEndDate}
              onChange={(e) => set("applicationEndDate", e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="quick-count" className="mb-1 block text-xs font-medium text-slate-600">Total posts</label>
            <input id="quick-count" value={form.vacancyCount} onChange={(e) => set("vacancyCount", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. 5244" />
          </div>
          <div>
            <label htmlFor="quick-age" className="mb-1 block text-xs font-medium text-slate-600">Age limit</label>
            <input id="quick-age" value={form.ageLimit} onChange={(e) => set("ageLimit", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. 18-32 years" />
          </div>
          <div>
            <label htmlFor="quick-fee" className="mb-1 block text-xs font-medium text-slate-600">Application fee</label>
            <input id="quick-fee"
              value={Object.entries(form.applicationFee ?? {}).map(([k, v]) => `${k}: ${v}`).join(", ")}
              onChange={(e) => {
                const map: Record<string, string> = {};
                for (const part of e.target.value.split(",")) {
                  const [k, ...rest] = part.split(":");
                  const amount = rest.join(":").trim();
                  const key = (k ?? "").trim();
                  if (key && amount) map[key] = amount;
                }
                set("applicationFee", Object.keys(map).length ? map : null);
              }}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="General/OBC: 100, SC/ST/PwBD: 0" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="quick-official" className="mb-1 block text-xs font-medium text-slate-600">Official notification URL</label>
            <input id="quick-official" value={form.officialNotificationUrl}
              onChange={(e) => set("officialNotificationUrl", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="https://…gov.in/…notice.pdf" />
          </div>
          <div>
            <label htmlFor="quick-apply" className="mb-1 block text-xs font-medium text-slate-600">Application URL</label>
            <input id="quick-apply" value={form.applicationUrl} onChange={(e) => set("applicationUrl", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="https://…" />
          </div>
        </div>
      </div>

      {/* ── The duplicate gate ───────────────────────────────────────────── */}
      {(checking || duplicates.length > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4" data-testid="quick-add-duplicates">
          {checking && (
            <p className="flex items-center gap-2 text-xs text-amber-800">
              <Loader2 size={13} className="animate-spin" /> Checking the existing vacancies…
            </p>
          )}
          {!checking && duplicates.length > 0 && (
            <>
              <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <AlertTriangle size={15} /> This notice looks like one you already have
              </p>
              <ul className="mt-2 space-y-1">
                {duplicates.map((d) => (
                  <li key={d.id} className="text-xs text-amber-900">
                    <button type="button" onClick={() => navigate(`/vacancies/${d.id}`)}
                      className="inline-flex items-center gap-1 underline">
                      {d.title} <ExternalLink size={11} />
                    </button>
                    <span className="ml-2 text-amber-700">
                      ({d.reason === "slug" ? "same slug" : "same notice"} · {d.workflowStatus})
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-amber-800">
                Open the existing row and add the new dates to it. Creating a second copy splits the
                clicks between two URLs.
              </p>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">
          This creates a DRAFT. Publishing needs the publish permission and happens on the edit page.
        </p>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Create draft
        </button>
      </div>
    </div>
  );
}
