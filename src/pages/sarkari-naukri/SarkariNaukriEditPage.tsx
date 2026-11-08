import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Trash2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  getSarkariNaukriById, createSarkariNaukri, updateSarkariNaukri,
  deleteSarkariNaukri, verifySarkariNaukri, type SarkariNaukri, type SarkariNaukriInput,
  type RecruitmentType,
} from "@/services/sarkariNaukriService";
import { getRegions, type Region } from "@/services/regionService";
import { OpenReportsBanner } from "@/components/messages/OpenReportsBanner";

// Verification is enforced server-side by the DB trigger (migration
// 20260927140000_sarkari_verification_trigger.sql). That migration is APPLIED to
// the live database (verified 2026-09-28: constraint + trigger present, trigger
// proven 8/8 as the authenticated role), so the Verify action is enabled. A
// trigger refusal is surfaced to the editor in plain words (see humanizeVerifyError).
const VERIFICATION_ENABLED = true;

export function SarkariNaukriEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [item, setItem] = useState<Partial<SarkariNaukriInput>>({
    recruitmentType: "direct",
    title: "",
    slug: "",
    organization: "",
    state: "",
    category: "",
    status: "upcoming",
    workflowStatus: "draft",
  });

  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);

  // Region vocabulary for the picker (states + UTs + all-india). Loaded once.
  useEffect(() => {
    getRegions().then(setRegions).catch(() => setRegions([]));
  }, []);

  useEffect(() => {
    if (!isNew && id) {
      getSarkariNaukriById(id)
        .then((data) => {
          if (!data) { toast.error("Entry not found"); navigate("/vacancies"); return; }
          setItem(data as any);
          setVerifiedAt(data.verifiedAt ?? null);
        })
        .catch(() => toast.error("Failed to load"))
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 255);

  const handleChange = (key: string, value: any) => {
    setItem((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === "title" && isNew) {
        updated.slug = generateSlug(value);
      }
      return updated;
    });
  };

  /**
   * The fee column is a JSON map ({ "General/OBC": "100" }). The input is plain text
   * ("General/OBC: 100, SC/ST/PwBD: 0") because that is what a notice prints and what
   * the owner can check against the notice. This is the one-way parse; the input always
   * shows the stored map re-serialised, so what is saved is always what is on screen.
   */
  const feeText = Object.entries((item.applicationFee ?? {}) as Record<string, string>)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const parseFeeText = (text: string): Record<string, string> | null => {
    const map: Record<string, string> = {};
    for (const part of text.split(",")) {
      const [key, ...rest] = part.split(":");
      const amount = rest.join(":").trim();
      const k = (key ?? "").trim();
      if (k && amount) map[k] = amount;
    }
    return Object.keys(map).length ? map : null;
  };

  const handleSave = async () => {
    if (!item.title?.trim()) { toast.error("Title is required"); return; }
    if (!item.slug?.trim()) { toast.error("Slug is required"); return; }
    if (!item.organization?.trim()) { toast.error("Organization is required"); return; }
    // State is the vacancy's routing key (becomes exams.region at merge). Required
    // on create, chosen from the regions list — no free text, no silent blank.
    if (!item.state?.trim()) { toast.error("State is required — choose All India for national vacancies"); return; }
    // Validate date ordering: start must not be after end when both are present.
    if (item.applicationStartDate && item.applicationEndDate && item.applicationStartDate > item.applicationEndDate) {
      toast.error("Application start date must be on or before end date"); return;
    }
    // Publish warning (not a block): "dates awaited" is a legitimate state.
    if (item.workflowStatus === "published" && !item.applicationEndDate) {
      toast.warning("Publishing without an application end date — readers will see 'Dates awaited'.");
    }

    setSaving(true);
    try {
      if (isNew) {
        const created = await createSarkariNaukri({
          ...item as SarkariNaukriInput,
          createdBy: user?.id ?? null,
        });
        toast.success("Created successfully");
        navigate(`/vacancies/${created.id}`);
      } else {
        await updateSarkariNaukri(id!, item);
        toast.success("Saved");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Owner batch 8, H2 — "Save + Verify": the fill-then-verify flow in one action.
   *
   * It runs the EXISTING path and nothing new: the same save, then the same
   * verifySarkariNaukri call the "Verify against official notification" button makes.
   * The database trigger (trg_sarkari_verify) is the authority — it refuses without an
   * official http(s) notification link, without an application end date, and without the
   * publish_post permission, and the refusal is shown in plain words (the service's
   * humanizeVerifyError).
   *
   * IT NEVER AUTO-VERIFIES. Verification only ever happens because somebody pressed
   * this button — there is no path in this page that verifies a row on its own.
   */
  const handleSaveAndVerify = async () => {
    if (!item.title?.trim()) { toast.error("Title is required"); return; }
    if (!item.slug?.trim()) { toast.error("Slug is required"); return; }
    if (!item.organization?.trim()) { toast.error("Organization is required"); return; }
    if (!item.state?.trim()) { toast.error("State is required — choose All India for national vacancies"); return; }
    if (item.applicationStartDate && item.applicationEndDate && item.applicationStartDate > item.applicationEndDate) {
      toast.error("Application start date must be on or before end date"); return;
    }
    setSaving(true);
    setVerifyError(null);
    try {
      let rowId = id;
      if (isNew) {
        const created = await createSarkariNaukri({
          ...item as SarkariNaukriInput,
          createdBy: user?.id ?? null,
        });
        rowId = created.id;
        navigate(`/vacancies/${created.id}`, { replace: true });
      } else {
        await updateSarkariNaukri(id!, item);
      }
      // The existing verify path — same call the standalone Verify button makes.
      const updated = await verifySarkariNaukri(rowId!);
      setVerifiedAt(updated.verifiedAt);
      toast.success("Saved and verified against the official notification.");
    } catch (err) {
      // The save may have succeeded and the VERIFY may have been refused — say which,
      // in plain words, and do not pretend the row is verified.
      const msg = err instanceof Error ? err.message : "Save + verify failed.";
      setVerifyError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this entry permanently?")) return;
    try {
      await deleteSarkariNaukri(id!);
      toast.success("Deleted");
      navigate("/vacancies");
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={24} /></div>;

  const isExam = item.recruitmentType === "exam";

  /**
   * Owner batch 7, C2a — the one-screen checklist. These are the five fields a vacancy needs
   * before its "last date" appears to a reader and before it can show as a Google job
   * listing, plus the verification that the notice was actually checked, in the order they
   * have to be filled. The three dates used to sit at the top of this screen and the two
   * links ~200 lines below it, past the Verify button - the wrong order for a job that must
   * be filled in sequence and then verified, which is why the database refuses verification
   * without a last date and an official link (trg_sarkari_verify).
   *
   * Owner batch 8, H2 — the checklist now states the JOB POSTING requirements in the
   * owner's own words: a window that is OPEN TODAY, the notification date, the end date,
   * the official notification link and the verification stamp. A row whose window has
   * closed only tells a reader the last date, which is why "window open today" is its own
   * item rather than a detail of the two date fields.
   */
  const today = new Date().toISOString().slice(0, 10);
  const windowOpenToday = !!(
    item.applicationStartDate && item.applicationEndDate &&
    item.applicationStartDate <= today && today <= item.applicationEndDate
  );
  const checklist = [
    { label: "Notification date", filled: !!item.notificationDate },
    { label: "Application start", filled: !!item.applicationStartDate },
    { label: "Last date to apply", filled: !!item.applicationEndDate },
    { label: "Window open today", filled: windowOpenToday },
    { label: "Official notification link", filled: !!item.officialNotificationUrl },
    { label: "Application link", filled: !!item.applicationUrl },
    { label: "Verified against the notice", filled: !!verifiedAt },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/vacancies")} className="rounded p-1 hover:bg-slate-100">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-semibold text-slate-900">{isNew ? "New Government Job" : "Edit Entry"}</h1>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <button onClick={handleDelete} className="inline-flex items-center gap-1 rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isNew ? "Create" : "Save"}
          </button>
          {/* Owner batch 8, H2 — fill-then-verify in one action. It saves and then
              runs the EXISTING verify path; a refusal is shown in plain words and
              nothing is ever verified on its own. */}
          <button type="button" onClick={handleSaveAndVerify} disabled={saving}
            data-testid="vacancy-save-and-verify"
            className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Save + Verify
          </button>
        </div>
      </div>

      <OpenReportsBanner entityId={isNew ? null : id} />

      {/* Vacancy window — the five fields the reader-facing page and the job listing need,
          plus verification, in fill order. Drives the status badge and the last-date line. */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Vacancy window</h2>
        <p className="mb-3 text-xs text-slate-500">
          Fill these in this order, then Verify. A page with no last date tells readers
          “Dates awaited”, and a vacancy that is not verified or has no official link is never
          shown to Google as a job listing.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="vac-notification-date" className="mb-1 block text-xs font-medium text-slate-600">Notification Date</label>
            <input id="vac-notification-date" type="date" value={item.notificationDate ?? ""} onChange={(e) => handleChange("notificationDate", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="vac-application-start" className="mb-1 block text-xs font-medium text-slate-600">Application Start</label>
            <input id="vac-application-start" type="date" value={item.applicationStartDate ?? ""} onChange={(e) => handleChange("applicationStartDate", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="vac-application-end" className="mb-1 block text-xs font-medium text-slate-600">Application End (Last Date)</label>
            <input id="vac-application-end" type="date" value={item.applicationEndDate ?? ""} onChange={(e) => handleChange("applicationEndDate", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </div>
        </div>

        {/* Moved up from the "Links" card (C2a): these two are part of the same job. */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="vac-official-notification-url" className="mb-1 block text-xs font-medium text-slate-600">Official Notification URL</label>
            <input id="vac-official-notification-url" value={item.officialNotificationUrl ?? ""} onChange={(e) => handleChange("officialNotificationUrl", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="https://…gov.in/…notice.pdf" />
            <p className="mt-0.5 text-[11px] text-slate-400">The notice you are working from. Required before this row can be verified.</p>
          </div>
          <div>
            <label htmlFor="vac-application-url" className="mb-1 block text-xs font-medium text-slate-600">Application URL</label>
            <input id="vac-application-url" value={item.applicationUrl ?? ""} onChange={(e) => handleChange("applicationUrl", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="https://…" />
            <p className="mt-0.5 text-[11px] text-slate-400">Where the reader applies. Shown as the Apply link on the page.</p>
          </div>
        </div>

        <ul role="status" aria-label="What is still missing on this vacancy" data-testid="vacancy-checklist"
            className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {checklist.map((f) => (
            <li key={f.label} className={f.filled ? "text-green-700" : "text-amber-700"}>
              {f.filled ? "✓" : "○"} {f.label}
            </li>
          ))}
        </ul>
      </div>

      {/* Recruitment Type Toggle */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">Recruitment Type</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleChange("recruitmentType", "exam")}
            className={`flex-1 rounded-lg border-2 p-4 text-center transition ${isExam ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}
          >
            <p className="text-lg">📝</p>
            <p className="mt-1 font-medium text-sm">Sarkari Exam</p>
            <p className="text-xs text-slate-500">Written/online competitive exam</p>
          </button>
          <button
            type="button"
            onClick={() => handleChange("recruitmentType", "direct")}
            className={`flex-1 rounded-lg border-2 p-4 text-center transition ${!isExam ? "border-green-500 bg-green-50" : "border-slate-200 hover:border-slate-300"}`}
          >
            <p className="text-lg">📋</p>
            <p className="mt-1 font-medium text-sm">Sarkari Bharti</p>
            <p className="text-xs text-slate-500">Walk-in / merit / direct recruitment</p>
          </button>
        </div>
      </div>

      {/* Basic Details */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Basic Details</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Title *</label>
            <input value={item.title ?? ""} onChange={(e) => handleChange("title", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. SSC CGL 2026 Notification" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Slug *</label>
            <input value={item.slug ?? ""} onChange={(e) => handleChange("slug", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Organization *</label>
            <input value={item.organization ?? ""} onChange={(e) => handleChange("organization", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. SSC, UPSC, WCD Bihar" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">State *</label>
            <select value={item.state ?? ""} onChange={(e) => handleChange("state", e.target.value)}
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
            <p className="mt-0.5 text-[11px] text-slate-400">Which state page this vacancy appears on. Choose All India for national vacancies.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
            <input value={item.category ?? ""} onChange={(e) => handleChange("category", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. ssc, anganwadi, railway" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Department</label>
            <input value={item.department ?? ""} onChange={(e) => handleChange("department", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. Ministry of Railways" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Vacancies</label>
            <input type="number" value={item.vacancyCount ?? ""} onChange={(e) => handleChange("vacancyCount", e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. 4500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <select value={item.status ?? "upcoming"} onChange={(e) => handleChange("status", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm">
              <option value="upcoming">Upcoming</option>
              <option value="application-open">Application Open</option>
              <option value="application-closed">Application Closed</option>
              {isExam && <option value="admit-card-released">Admit Card Released</option>}
              {isExam && <option value="exam-scheduled">Exam Scheduled</option>}
              {isExam && <option value="answer-key-released">Answer Key Released</option>}
              {isExam && <option value="result-declared">Result Declared</option>}
              {!isExam && <option value="interview-scheduled">Interview Scheduled</option>}
              {!isExam && <option value="merit-list-released">Merit List Released</option>}
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {/* Application dates live in the "Key Dates" card at the top. */}
        </div>
        {/* Verification status */}
        <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
          {verifiedAt ? (
            <span className="text-xs text-green-700 font-medium">Verified {new Date(verifiedAt).toLocaleDateString("en-IN")}</span>
          ) : (
            <span className="text-xs text-amber-600 font-medium">Unverified</span>
          )}
          {!isNew && VERIFICATION_ENABLED && !verifiedAt && (
            <button type="button" disabled={verifying}
              onClick={async () => {
                setVerifying(true); setVerifyError(null);
                try { const updated = await verifySarkariNaukri(id!); setVerifiedAt(updated.verifiedAt); toast.success("Verified"); }
                catch (err) {
                  // verifySarkariNaukri throws an Error whose message is already plain
                  // words (humanizeVerifyError maps the trigger's refusals).
                  const msg = err instanceof Error ? err.message : "Verification failed. Please try again.";
                  setVerifyError(msg); toast.error(msg);
                }
                finally { setVerifying(false); }
              }}
              className="text-xs rounded border border-green-300 px-2 py-1 text-green-700 hover:bg-green-50 disabled:opacity-50">
              {verifying ? "Verifying…" : "Verify against official notification"}
            </button>
          )}
          {verifyError && (
            <span className="text-xs text-red-600 font-medium">{verifyError}</span>
          )}
          {!VERIFICATION_ENABLED && !verifiedAt && (
            <span className="text-xs italic text-slate-400">verification not yet enabled</span>
          )}
        </div>
      </div>

      {/* Other Dates — exam/direct-specific and result date */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Other Dates</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {isExam && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Exam Date</label>
                <input type="date" value={item.examDate ?? ""} onChange={(e) => handleChange("examDate", e.target.value || null)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Admit Card Date</label>
                <input type="date" value={item.admitCardDate ?? ""} onChange={(e) => handleChange("admitCardDate", e.target.value || null)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Answer Key Date</label>
                <input type="date" value={item.answerKeyDate ?? ""} onChange={(e) => handleChange("answerKeyDate", e.target.value || null)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </div>
            </>
          )}
          {!isExam && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Interview Date</label>
                <input type="date" value={item.interviewDate ?? ""} onChange={(e) => handleChange("interviewDate", e.target.value || null)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Document Verification</label>
                <input type="date" value={item.documentVerificationDate ?? ""} onChange={(e) => handleChange("documentVerificationDate", e.target.value || null)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Merit List Date</label>
                <input type="date" value={item.meritListDate ?? ""} onChange={(e) => handleChange("meritListDate", e.target.value || null)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </div>
            </>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Result Date</label>
            <input type="date" value={item.resultDate ?? ""} onChange={(e) => handleChange("resultDate", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      {/* Links & URLs */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Links</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="text-xs text-slate-500">
              The <span className="font-medium">application</span> and <span className="font-medium">official notification</span>
              links now live above, in <span className="font-medium">Vacancy window</span>, next to the dates they belong to.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Result URL</label>
            <input value={item.resultUrl ?? ""} onChange={(e) => handleChange("resultUrl", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="https://..." />
          </div>
          {isExam && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Admit Card URL</label>
              <input value={item.admitCardUrl ?? ""} onChange={(e) => handleChange("admitCardUrl", e.target.value || null)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="https://..." />
            </div>
          )}
          {!isExam && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Merit List URL</label>
              <input value={item.meritListUrl ?? ""} onChange={(e) => handleChange("meritListUrl", e.target.value || null)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="https://..." />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Content & Eligibility</h2>
        {/* Owner batch 8, H1/H2 — the age limit and the fee had COLUMNS but no input,
            so the "quick add from notice" proposals had nowhere to land. They are read
            by the reader-facing page, so they belong next to the eligibility text. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="vac-age-limit" className="mb-1 block text-xs font-medium text-slate-600">Age Limit</label>
            <input id="vac-age-limit" value={item.ageLimit ?? ""} onChange={(e) => handleChange("ageLimit", e.target.value || null)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. 18-32 years" />
            <p className="mt-0.5 text-[11px] text-slate-400">As printed in the notice, e.g. &quot;18-32 years&quot;.</p>
          </div>
          <div>
            <label htmlFor="vac-application-fee" className="mb-1 block text-xs font-medium text-slate-600">Application Fee</label>
            <input id="vac-application-fee" value={feeText} onChange={(e) => handleChange("applicationFee", parseFeeText(e.target.value))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="General/OBC: 100, SC/ST/PwBD: 0" />
            <p className="mt-0.5 text-[11px] text-slate-400">One category per entry: &quot;Category: amount&quot;, separated by commas.</p>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Eligibility</label>
          <textarea value={item.eligibility ?? ""} onChange={(e) => handleChange("eligibility", e.target.value || null)}
            rows={3} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="Education, age, nationality..." />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Description (HTML)</label>
          <textarea value={item.description ?? ""} onChange={(e) => handleChange("description", e.target.value || null)}
            rows={8} className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono text-xs" placeholder="<h2>Details</h2><p>...</p>" />
        </div>
      </div>

      {/* Publishing */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Publishing</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Workflow Status</label>
            <select value={item.workflowStatus ?? "draft"} onChange={(e) => handleChange("workflowStatus", e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm">
              <option value="draft">Draft</option>
              <option value="review">In Review</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="flex items-center gap-4 pt-5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.isFeatured ?? false} onChange={(e) => handleChange("isFeatured", e.target.checked)} className="h-4 w-4 rounded" />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.isNew ?? false} onChange={(e) => handleChange("isNew", e.target.checked)} className="h-4 w-4 rounded" />
              New
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.isUrgent ?? false} onChange={(e) => handleChange("isUrgent", e.target.checked)} className="h-4 w-4 rounded" />
              Urgent
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
