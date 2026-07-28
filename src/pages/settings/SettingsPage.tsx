import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Check, X, RefreshCw, TestTube2 } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { getAllSettings, updateSettingsBulk, testSupabaseConnection } from "@/services/settingsService";
import { generateWithGemini, listAvailableModels } from "@/lib/gemini/client";
import { clearApiKeyCache, setAutofillApiKey } from "@/lib/ai/autofill";
import { AIProviderManager } from "@/components/settings/AIProviderManager";
import {
  revalidatePath, revalidateAll,
} from "@/lib/api/frontend";
import { SITE } from "@/config/site";
import { cn , getErrorMessage } from "@/lib/utils";
import type { Setting, SettingGroup } from "@/types/settings";

type Tab = { id: SettingGroup | "integrations"; label: string; icon: string };

const TABS: Tab[] = [
  { id: "general",      label: "General",           icon: "⚙️" },
  { id: "database",     label: "Database",          icon: "🗄️" },
  { id: "ai",           label: "AI (Gemini)",       icon: "✨" },
  { id: "seo",          label: "SEO",               icon: "🔍" },
  { id: "notifications",label: "Notifications",     icon: "🔔" },
  { id: "integrations", label: "Frontend",          icon: "🔗" },
  { id: "ads",          label: "Ads",               icon: "📢" },
  { id: "appearance",   label: "Appearance",        icon: "🎨" },
];

function MaskedInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-slate-200 px-3 py-2 pr-10 text-sm font-mono focus:border-blue-500 focus:outline-none" />
      <button type="button" onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 items-start py-4 border-b border-slate-100 last:border-0">
      <div>
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", value ? "bg-blue-600" : "bg-slate-200")}>
      <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", value ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}

export function SettingsPage() {
  const { getSetting, updateSetting, refreshSettings } = useSettings();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("general");
  const [allSettings, setAllSettings] = useState<Setting[]>([]);
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<Record<string, unknown>>({});

  useEffect(() => {
    getAllSettings()
      .then((s) => {
        setAllSettings(s);
        const map: Record<string, unknown> = {};
        s.forEach((item) => { map[item.key] = item.value; });
        setLocal(map);
      })
      .catch((err) => toast.error("Failed to load settings: " + getErrorMessage(err)));
  }, []);

  const get = (key: string, def: unknown = "") => {
    return key in local ? local[key] : (getSetting(key as never, def as never) ?? def);
  };
  const set = (key: string, value: unknown) => setLocal((prev) => ({ ...prev, [key]: value }));

  const save = async (keys: string[]) => {
    setSaving(true);
    try {
      await updateSettingsBulk(keys.map((k) => ({ key: k, value: local[k] as never })), user?.id);
      await refreshSettings();
      // If AI key was saved, update the autofill module with the new key
      if (keys.includes("gemini_api_key")) {
        setAutofillApiKey(local["gemini_api_key"] as string);
      }
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // DB test state
  const [dbStatus, setDbStatus] = useState<"idle"|"testing"|"ok"|"fail">("idle");
  const [dbError, setDbError] = useState("");
  const [dbCount, setDbCount] = useState(0);

  const testDb = async () => {
    setDbStatus("testing");
    const url = get("supabase_url", "") as string;
    const key = get("supabase_anon_key", "") as string;
    const res = await testSupabaseConnection(url, key);
    if (res.connected) {
      setDbStatus("ok"); setDbCount(res.examCount ?? 0);
      set("db_status", "connected");
      await updateSetting("db_status", "connected");
    } else {
      setDbStatus("fail"); setDbError(res.error ?? "Connection failed");
    }
  };

  // AI test state
  const [aiStatus, setAiStatus] = useState<"idle"|"testing"|"ok"|"fail">("idle");
  const [aiError, setAiError] = useState("");
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [keyStatuses, setKeyStatuses] = useState<Record<string, "idle"|"ok"|"fail">>({});

  const testSingleKey = async (key: string, keyLabel: string) => {
    if (!key) return;
    setTestingKey(keyLabel);
    try {
      await generateWithGemini("Say 'connected' in one word.", key, undefined);
      setKeyStatuses((prev) => ({ ...prev, [keyLabel]: "ok" }));
      toast.success(`${keyLabel}: Connected ✅`);
    } catch (err) {
      setKeyStatuses((prev) => ({ ...prev, [keyLabel]: "fail" }));
      toast.error(`${keyLabel}: ${getErrorMessage(err)}`);
    } finally {
      setTestingKey(null);
    }
  };

  const testAi = async () => {
    setAiStatus("testing");
    setAiError("");
    const apiKey = get("gemini_api_key","") as string;
    const model = get("gemini_model","gemini-2.5-flash") as string;
    
    try {
      await generateWithGemini("Say 'connected' in one word.", apiKey, model);
      setAiStatus("ok");
    } catch (err) {
      const msg = getErrorMessage(err);
      // If 404, try listing models to help debug
      if (msg.includes("not found")) {
        const models = await listAvailableModels(apiKey);
        if (models.length > 0) {
          const flash = models.find(m => m.includes("flash") && !m.includes("lite") && !m.includes("image"));
          setAiError(`Model "${model}" not available. Your key has access to: ${models.slice(0, 5).join(", ")}${flash ? `. Try: ${flash}` : ""}`);
        } else {
          setAiError(msg + " Could not list models — check if your API key is valid.");
        }
      } else {
        setAiError(msg);
      }
      setAiStatus("fail");
    }
  };

  // Revalidation
  const frontendUrl = get("frontend_url", SITE.frontendUrl) as string;
  const revalToken = get("revalidate_token", "") as string;
  const [revalResults, setRevalResults] = useState<Record<string, "idle"|"ok"|"fail">>({});

  const revalidate = async (label: string, fn: () => Promise<unknown>) => {
    setRevalResults((p) => ({ ...p, [label]: "idle" }));
    try { await fn(); setRevalResults((p) => ({ ...p, [label]: "ok" })); }
    catch { setRevalResults((p) => ({ ...p, [label]: "fail" })); }
  };

  return (
    <div className="flex gap-6">
      {/* Tab list */}
      <aside className="w-48 shrink-0">
        <h1 className="mb-4 text-xl font-semibold text-slate-900">Settings</h1>
        <nav className="space-y-0.5">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition-colors",
                activeTab === tab.id ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-100"
              )}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Tab content */}
      <div className="flex-1 rounded-lg border border-slate-200 bg-white p-6">
        {/* ── GENERAL ─────────────────────────────── */}
        {activeTab === "general" && (
          <div>
            <h2 className="mb-4 text-base font-semibold text-slate-900">General Settings</h2>
            {[
              { key: "site_name",       label: "Site Name" },
              { key: "site_tagline",    label: "Site Tagline" },
              { key: "site_url",        label: "Frontend URL", hint: "Public site URL" },
              { key: "contact_email",   label: "Contact Email" },
              { key: "whatsapp_number", label: "WhatsApp Number", hint: "+91XXXXXXXXXX" },
              { key: "telegram_channel",label: "Telegram Channel URL" },
              { key: "youtube_channel", label: "YouTube Channel URL" },
            ].map(({ key, label, hint }) => (
              <Field key={key} label={label} hint={hint}>
                <input value={(get(key) as string) ?? ""} onChange={(e) => set(key, e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </Field>
            ))}
            <Field label="Posts Per Page">
              <input type="number" value={(get("posts_per_page",20) as number)} onChange={(e) => set("posts_per_page", parseInt(e.target.value))}
                className="w-32 rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </Field>
            <div className="mt-6">
              <button onClick={() => save(["site_name","site_tagline","site_url","contact_email","whatsapp_number","telegram_channel","youtube_channel","posts_per_page"])} disabled={saving}
                className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />} Save General Settings
              </button>
            </div>
          </div>
        )}

        {/* ── DATABASE ──────────────────────────────── */}
        {activeTab === "database" && (
          <div>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Database Setup</h2>
            <Field label="Supabase Project URL">
              <input value={(get("supabase_url","") as string)} onChange={(e) => set("supabase_url", e.target.value)}
                placeholder="https://xxxx.supabase.co"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
            </Field>
            <Field label="Supabase Anon Key" hint="Safe to expose in browser">
              <MaskedInput value={(get("supabase_anon_key","") as string)} onChange={(v) => set("supabase_anon_key", v)} placeholder="eyJ..." />
            </Field>
            <Field label="Service Role Key" hint="Never expose to frontend">
              <MaskedInput value={(get("supabase_service_key","") as string)} onChange={(v) => set("supabase_service_key", v)} placeholder="eyJ..." />
            </Field>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => save(["supabase_url","supabase_anon_key","supabase_service_key"])} disabled={saving}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                Save
              </button>
              <button onClick={testDb} disabled={dbStatus === "testing"}
                className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {dbStatus === "testing" ? <Loader2 size={14} className="animate-spin" /> : <TestTube2 size={14} />}
                Test Connection
              </button>
              {dbStatus === "ok" && <span className="flex items-center gap-1 text-sm text-green-600"><Check size={14} /> Connected — {dbCount} exams</span>}
              {dbStatus === "fail" && <span className="flex items-center gap-1 text-sm text-red-600"><X size={14} /> {dbError}</span>}
            </div>
            <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
              <p className="font-medium text-slate-800">DB Status</p>
              <p>● {(get("db_status","disconnected") as string) === "connected" ? <span className="text-green-600">Connected</span> : <span className="text-red-500">Disconnected</span>}</p>
            </div>
          </div>
        )}

        {/* ── AI ────────────────────────────────────── */}
        {activeTab === "ai" && <AIProviderManager />}

        {/* ── SEO ───────────────────────────────────── */}
        {activeTab === "seo" && (
          <div>
            <h2 className="mb-4 text-base font-semibold text-slate-900">SEO Settings</h2>
            {[
              { key: "ga_id",         label: "Google Analytics ID", hint: "G-XXXXXXXXXX" },
              { key: "gsc_verify",    label: "GSC Verification Code" },
              { key: "adsense_id",    label: "AdSense Publisher ID", hint: "ca-pub-XXXXXXXXXXXXXXXX" },
            ].map(({ key, label, hint }) => (
              <Field key={key} label={label} hint={hint}>
                <input value={(get(key,"") as string)} onChange={(e) => set(key, e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </Field>
            ))}
            <Field label="Default OG Image URL">
              <input value={(get("default_og_image","") as string)} onChange={(e) => set("default_og_image", e.target.value)}
                placeholder="https://..." className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </Field>
            <Field label="Robots.txt" hint="Controls crawler access">
              <textarea value={(get("robots_txt","") as string)} onChange={(e) => set("robots_txt", e.target.value)}
                rows={6} className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
            </Field>
            <div className="mt-4">
              <button onClick={() => save(["ga_id","gsc_verify","adsense_id","default_og_image","robots_txt"])} disabled={saving}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                Save SEO Settings
              </button>
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS ─────────────────────────── */}
        {activeTab === "notifications" && (
          <div>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Telegram Notifications</h2>
            <Field label="Bot Token" hint="From @BotFather">
              <MaskedInput value={(get("telegram_bot_token","") as string)} onChange={(v) => set("telegram_bot_token", v)} placeholder="1234567890:AAF..." />
            </Field>
            <Field label="Post Channel ID" hint="e.g. @indianexaminfo or -100123456789">
              <input value={(get("telegram_post_channel","") as string)} onChange={(e) => set("telegram_post_channel", e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </Field>
            <Field label="Notify on Publish">
              <Toggle value={get("notify_on_publish",true) as boolean} onChange={(v) => set("notify_on_publish", v)} />
            </Field>
            <Field label="Notify on Result Published">
              <Toggle value={get("notify_on_result",true) as boolean} onChange={(v) => set("notify_on_result", v)} />
            </Field>
            <Field label="Message Template" hint="Variables: {title} {excerpt} {url} {exam_name} {content_type} {date}">
              <textarea value={(get("telegram_template","") as string)} onChange={(e) => set("telegram_template", e.target.value)}
                rows={4} className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
            </Field>
            <div className="mt-4">
              <button onClick={() => save(["telegram_bot_token","telegram_post_channel","notify_on_publish","notify_on_result","telegram_template"])} disabled={saving}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                Save Notification Settings
              </button>
            </div>
          </div>
        )}

        {/* ── FRONTEND INTEGRATION ──────────────────── */}
        {activeTab === "integrations" && (
          <div>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Frontend Integration</h2>
            <Field label="Frontend Base URL">
              <input value={(get("frontend_url",SITE.frontendUrl) as string)} onChange={(e) => set("frontend_url", e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
            </Field>
            <Field label="Revalidate Token" hint="Must match REVALIDATE_TOKEN in frontend .env">
              <MaskedInput value={(get("revalidate_token","") as string)} onChange={(v) => set("revalidate_token", v)} placeholder="secret-token-here" />
            </Field>
            <Field label="Auto-Revalidate on Publish">
              <Toggle value={get("revalidate_on_publish",true) as boolean} onChange={(v) => set("revalidate_on_publish", v)} />
            </Field>
            <div className="mt-4 mb-6">
              <button onClick={() => save(["frontend_url","revalidate_token","revalidate_on_publish"])} disabled={saving}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                Save
              </button>
            </div>

            <h3 className="mb-3 text-sm font-semibold text-slate-900">Manual Revalidation</h3>
            <p className="mb-3 text-xs text-slate-500">
              Uses <code className="bg-slate-100 px-1 rounded">x-revalidate-token</code> header. One request per path, 100ms delay between batches.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Revalidate Homepage",        fn: () => revalidatePath("/", frontendUrl, revalToken) },
                { label: "Revalidate All Admit Cards", fn: () => revalidatePath("/admit-card", frontendUrl, revalToken) },
                { label: "Revalidate All Results",     fn: () => revalidatePath("/results", frontendUrl, revalToken) },
                { label: "Revalidate Answer Keys",     fn: () => revalidatePath("/answer-key", frontendUrl, revalToken) },
                { label: "Revalidate Sitemap",         fn: () => revalidatePath("/sitemap.xml", frontendUrl, revalToken) },
                { label: "Revalidate Everything",      fn: () => revalidateAll(frontendUrl, revalToken) },
              ].map(({ label, fn }) => (
                <button key={label} onClick={() => revalidate(label, fn)}
                  className="flex items-center justify-between rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  <span>{label}</span>
                  {revalResults[label] === "ok" && <Check size={14} className="text-green-500" />}
                  {revalResults[label] === "fail" && <X size={14} className="text-red-500" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── ADS ───────────────────────────────────── */}
        {activeTab === "ads" && (
          <div>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Ad Settings</h2>
            <Field label="Enable Direct Ad Manager">
              <Toggle value={get("direct_ads_enabled",true) as boolean} onChange={(v) => set("direct_ads_enabled", v)} />
            </Field>
            <Field label="Enable AdSense Fallback">
              <Toggle value={get("adsense_enabled",false) as boolean} onChange={(v) => set("adsense_enabled", v)} />
            </Field>
            <Field label="AdSense Publisher ID" hint="ca-pub-XXXXXXXXXXXXXXXX">
              <input value={(get("adsense_id","") as string)} onChange={(e) => set("adsense_id", e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </Field>
            <Field label="Default Fallback Ad HTML" hint="Shown when no campaign targets a zone">
              <textarea value={(get("default_ad_html","") as string)} onChange={(e) => set("default_ad_html", e.target.value)}
                rows={5} className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
            </Field>
            <div className="mt-4">
              <button onClick={() => save(["direct_ads_enabled","adsense_enabled","adsense_id","default_ad_html"])} disabled={saving}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                Save Ad Settings
              </button>
            </div>
          </div>
        )}

        {/* ── APPEARANCE ────────────────────────────── */}
        {activeTab === "appearance" && (
          <div>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Appearance</h2>
            <Field label="Primary Color" hint="Frontend nav / buttons (#1A3C6E)">
              <div className="flex items-center gap-3">
                <input type="color" value={(get("primary_color","#1A3C6E") as string)} onChange={(e) => set("primary_color", e.target.value)}
                  className="h-9 w-14 rounded border border-slate-200 p-1 cursor-pointer" />
                <input value={(get("primary_color","#1A3C6E") as string)} onChange={(e) => set("primary_color", e.target.value)}
                  className="w-28 rounded border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
            </Field>
            <Field label="Accent Color" hint="CTA buttons / alerts (#D0342C)">
              <div className="flex items-center gap-3">
                <input type="color" value={(get("accent_color","#D0342C") as string)} onChange={(e) => set("accent_color", e.target.value)}
                  className="h-9 w-14 rounded border border-slate-200 p-1 cursor-pointer" />
                <input value={(get("accent_color","#D0342C") as string)} onChange={(e) => set("accent_color", e.target.value)}
                  className="w-28 rounded border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
            </Field>
            <Field label="Editorial Color" hint="Blog / editorial accent (#E8630A)">
              <div className="flex items-center gap-3">
                <input type="color" value={(get("editorial_color","#E8630A") as string)} onChange={(e) => set("editorial_color", e.target.value)}
                  className="h-9 w-14 rounded border border-slate-200 p-1 cursor-pointer" />
                <input value={(get("editorial_color","#E8630A") as string)} onChange={(e) => set("editorial_color", e.target.value)}
                  className="w-28 rounded border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
            </Field>
            <Field label="Logo URL">
              <input value={(get("logo_url","") as string)} onChange={(e) => set("logo_url", e.target.value)}
                placeholder="https://..." className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </Field>
            <Field label="Favicon URL">
              <input value={(get("favicon_url","") as string)} onChange={(e) => set("favicon_url", e.target.value)}
                placeholder="https://..." className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </Field>
            <Field label="Footer Tagline">
              <input value={(get("footer_tagline","") as string)} onChange={(e) => set("footer_tagline", e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </Field>

            {/* Live preview */}
            <div className="mt-6 rounded-lg border border-slate-200 p-4">
              <p className="mb-3 text-xs font-semibold uppercase text-slate-500 tracking-wide">Preview</p>
              <div className="flex items-center gap-3 rounded p-3" style={{ backgroundColor: get("primary_color","#1A3C6E") as string }}>
                <div className="h-8 w-8 rounded bg-white/20 flex items-center justify-center text-white text-sm font-bold">IE</div>
                <span className="text-white font-semibold text-sm">IndianExamInfo</span>
                <span className="ml-auto rounded px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: get("accent_color","#D0342C") as string }}>
                  Latest Results
                </span>
              </div>
            </div>

            <div className="mt-4">
              <button onClick={() => save(["primary_color","accent_color","editorial_color","logo_url","favicon_url","footer_tagline"])} disabled={saving}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                Save Appearance
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
