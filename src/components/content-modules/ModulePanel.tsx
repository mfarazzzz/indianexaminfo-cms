/**
 * ModulePanel — Unified content module editing interface with smart data binding.
 *
 * Features: Enable/disable, data modes (auto/hybrid/manual), AI Fill per-module,
 * stale detection, auto-population from source data (Dates, SEO, News, Identity).
 */
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ModulePanelHeader } from "./ModulePanelHeader";
import { ContentModuleCard } from "./ContentModuleCard";
import { getModuleRegistry } from "@/services/moduleRegistryService";
import { getContentModules, saveModuleConfig, toggleModuleEnabled, saveModuleContent } from "@/services/moduleContentService";
import { BUILT_IN_MODULES } from "@/lib/modules/builtInSchemas";
import { resolveModuleContent, getModuleMode, setModuleMode, getDefaultBindingConfig, countStaleModules, type DataMode, type BindingConfig } from "@/lib/modules/dataBindingService";
import { aiGenerateForModule } from "@/lib/modules/moduleAI";
import type { ModuleDefinition, ModuleConfig, ContentModulesData, ModuleContentData, SaveStatus } from "@/types/modules";
import type { ExamIdentity, ExamEdition } from "@/services/entranceExamService";
import { getErrorMessage } from "@/lib/utils";
import { hasData, SECTION_BY_SLUG, type HasDataView } from "@/lib/sectionRegistry";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";

/**
 * Map a CMS module-registry slug to the frontend section slug that governs its
 * live visibility. Most match 1:1; a few module slugs differ from section slugs.
 */
const MODULE_SLUG_TO_SECTION: Record<string, string> = {
  "application-process": "how-to-apply",
  "vacancy-details": "vacancy",
};

/** Build the minimal view sectionRegistry.hasData needs from exam + edition. */
function buildHasDataView(
  exam: ExamIdentity | null | undefined,
  edition: ExamEdition | null | undefined,
  contentModules: ContentModulesData,
): HasDataView | null {
  if (!exam) return null;
  const elig = (edition?.eligibility ?? {}) as Record<string, unknown>;
  return {
    pillar: exam.pillar,
    dates: edition?.importantDates ?? [],
    eligibility: {
      qualification: (elig.qualification as string) ?? "",
      age: (elig.age as string) ?? "",
      nationality: (elig.nationality as string) ?? "",
    },
    vacancy: edition?.vacancy ?? null,
    applicationFee: (edition?.applicationFee ?? {}) as Record<string, number | undefined>,
    selectionProcess: exam.selectionProcess ?? [],
    syllabusHighlights: exam.syllabusHighlights ?? [],
    faqs: exam.faqs ?? edition?.faqs ?? [],
    contentModules: contentModules as Record<string, unknown>,
  };
}

interface Props {
  editionId: string | null;
  exam?: ExamIdentity | null;
  edition?: ExamEdition | null;
  legacyFlags?: Record<string, boolean>;
}

export function ModulePanel({ editionId, exam, edition, legacyFlags }: Props) {
  const [modules, setModules] = useState<ModuleDefinition[]>([]);
  const [contentModules, setContentModules] = useState<ContentModulesData>({});
  const [config, setConfig] = useState<ModuleConfig>({ moduleOrder: [], enabledModules: [], modes: {}, syncTimestamps: {} });
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const [aiLoadingSlug, setAiLoadingSlug] = useState<string | null>(null);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const { getSetting } = useSettings();
  const { user } = useAuth();

  const bindingConfig: BindingConfig = {
    modes: (config.modes ?? {}) as Record<string, DataMode>,
    syncTimestamps: (config.syncTimestamps ?? {}) as Record<string, string>,
  };

  const staleCount = countStaleModules(bindingConfig, exam ?? null, edition ?? null);

  // Snapshot used for the "Live / Hidden — no content yet" badge on each module.
  // Same predicate the public site uses (sectionRegistry.hasData), so the badge
  // reflects exactly what a visitor will and won't see.
  const liveView = buildHasDataView(exam, edition, contentModules);

  const aggregateStatus: SaveStatus = Object.values(statuses).includes("saving")
    ? "saving" : Object.values(statuses).includes("error")
      ? "error" : Object.values(statuses).includes("saved") ? "saved" : "idle";

  useEffect(() => { loadData(); }, [editionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    try {
      let registry: ModuleDefinition[];
      try { registry = await getModuleRegistry(exam?.pillar); } catch { registry = BUILT_IN_MODULES; }
      setModules(registry);

      if (editionId) {
        const data = await getContentModules(editionId);
        setContentModules(data);

        const existingConfig = data._config as ModuleConfig | undefined;
        if (existingConfig?.moduleOrder?.length) {
          setConfig({ ...existingConfig, modes: existingConfig.modes ?? {}, syncTimestamps: existingConfig.syncTimestamps ?? {} });
        } else {
          const enabledFromLegacy = legacyFlags
            ? Object.entries(legacyFlags).filter(([, v]) => v).map(([k]) => flagToSlug(k)).filter(Boolean) as string[]
            : [];
          const defaultConfig: ModuleConfig = {
            moduleOrder: registry.map((m) => m.slug),
            enabledModules: enabledFromLegacy.length > 0 ? enabledFromLegacy : [],
            modes: getDefaultBindingConfig().modes,
            syncTimestamps: {},
          };
          setConfig(defaultConfig);
          if (editionId) saveModuleConfig(editionId, defaultConfig).catch(() => {});
        }
      }
    } catch (err) {
      toast.error("Failed to load modules: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = useCallback(async (slug: string, enabled: boolean) => {
    if (!editionId) return;
    setConfig((prev) => ({
      ...prev,
      enabledModules: enabled ? [...prev.enabledModules.filter((s) => s !== slug), slug] : prev.enabledModules.filter((s) => s !== slug),
    }));
    try {
      const updated = await toggleModuleEnabled(editionId, slug, enabled);
      setConfig((prev) => ({ ...prev, enabledModules: updated.enabledModules }));
    } catch (err) { toast.error(getErrorMessage(err)); }
  }, [editionId]);

  const handleModeChange = useCallback(async (slug: string, mode: DataMode) => {
    if (!editionId) return;
    const newConfig = { ...config, modes: { ...config.modes, [slug]: mode } };
    setConfig(newConfig);
    await saveModuleConfig(editionId, newConfig).catch(() => {});
  }, [editionId, config]);

  const handleAIFill = useCallback(async (slug: string) => {
    if (!editionId || !exam) return;
    const apiKey = getSetting("gemini_api_key", "");
    const model = getSetting("gemini_model", "");
    if (!apiKey) { toast.error("No AI API key. Go to Settings → AI."); return; }

    setAiLoadingSlug(slug);
    try {
      const result = await aiGenerateForModule(slug, exam.name, edition?.year ?? new Date().getFullYear(), { identity: exam, edition: edition ?? null as any }, apiKey as string, model as string || undefined);
      await saveModuleContent(editionId, slug, result, user?.id ?? "system");
      setContentModules((prev) => ({ ...prev, [slug]: { ...result, _meta: { updatedAt: new Date().toISOString(), updatedBy: user?.id ?? "" } } }));
      toast.success(`AI generated content for ${modules.find((m) => m.slug === slug)?.name ?? slug}`);
    } catch (err) {
      toast.error("AI Fill failed: " + getErrorMessage(err));
    } finally {
      setAiLoadingSlug(null);
    }
  }, [editionId, exam, edition, modules, getSetting, user]);

  const handleSync = useCallback(async (slug: string) => {
    if (!editionId) return;
    const mode = getModuleMode(bindingConfig, slug);
    const resolved = resolveModuleContent(slug, mode, exam ?? null, edition ?? null, contentModules);
    if (resolved.autoContent) {
      await saveModuleContent(editionId, slug, resolved.autoContent, user?.id ?? "system");
      const newConfig = { ...config, syncTimestamps: { ...config.syncTimestamps, [slug]: new Date().toISOString() } };
      setConfig(newConfig);
      await saveModuleConfig(editionId, newConfig).catch(() => {});
      setContentModules((prev) => ({ ...prev, [slug]: { ...resolved.autoContent!, _meta: { updatedAt: new Date().toISOString(), updatedBy: user?.id ?? "" } } }));
      toast.success("Synced!");
    }
  }, [editionId, exam, edition, contentModules, config, bindingConfig, user]);

  const handleStatusChange = useCallback((slug: string, status: SaveStatus) => {
    setStatuses((prev) => ({ ...prev, [slug]: status }));
  }, []);

  const orderedModules = React.useMemo(() => {
    const ordered: ModuleDefinition[] = [];
    const seen = new Set<string>();
    for (const slug of config.moduleOrder) {
      const mod = modules.find((m) => m.slug === slug);
      if (mod) { ordered.push(mod); seen.add(slug); }
    }
    for (const mod of modules) { if (!seen.has(mod.slug)) ordered.push(mod); }
    return ordered;
  }, [modules, config.moduleOrder]);

  if (loading) {
    return <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>;
  }
  if (!editionId) {
    return <div className="text-center py-8"><p className="text-sm text-slate-400">Save the exam first to enable content modules.</p></div>;
  }

  return (
    <div>
      <ModulePanelHeader
        aggregateStatus={aggregateStatus}
        lastSavedAt={null}
        staleCount={staleCount}
        isVerified={exam?.isVerified}
        allCollapsed={allCollapsed}
        onToggleCollapse={() => setAllCollapsed(!allCollapsed)}
        onEnableAll={async () => {
          if (!editionId) return;
          const allSlugs = orderedModules.map((m) => m.slug);
          const newConfig = { ...config, enabledModules: allSlugs };
          setConfig(newConfig);
          await saveModuleConfig(editionId, newConfig).catch(() => {});
          toast.success("All modules enabled.");
        }}
        onDisableAll={async () => {
          if (!editionId) return;
          const newConfig = { ...config, enabledModules: [] };
          setConfig(newConfig);
          await saveModuleConfig(editionId, newConfig).catch(() => {});
          toast.success("All modules disabled.");
        }}
      />
      <p className="text-xs text-slate-500 mb-4">
        Modules auto-populate from Dates, SEO, and Identity data. Switch to Manual for full editing control.
      </p>
      <div className="space-y-2">
        {orderedModules.map((mod) => {
          const mode = getModuleMode(bindingConfig, mod.slug);
          const resolved = resolveModuleContent(mod.slug, mode, exam ?? null, edition ?? null, contentModules);
          // Live-visibility: does this section have content by the SAME rule the
          // public site uses? Only evaluated for slugs the registry knows about.
          const sectionSlug = MODULE_SLUG_TO_SECTION[mod.slug] ?? mod.slug;
          const hasLiveContent = liveView && SECTION_BY_SLUG[sectionSlug]
            ? hasData(liveView, sectionSlug)
            : undefined;
          return (
            <ContentModuleCard
              key={mod.slug}
              module={mod}
              enabled={config.enabledModules.includes(mod.slug)}
              editionId={editionId}
              content={(contentModules[mod.slug] as ModuleContentData) ?? null}
              mode={mode}
              isStale={resolved.isStale}
              autoContent={resolved.autoContent}
              onToggle={(enabled) => handleToggle(mod.slug, enabled)}
              onModeChange={(m) => handleModeChange(mod.slug, m)}
              onAIFill={handleAIFill}
              onSync={handleSync}
              onStatusChange={handleStatusChange}
              aiLoading={aiLoadingSlug === mod.slug}
              forceCollapsed={allCollapsed}
              hasLiveContent={hasLiveContent}
            />
          );
        })}
      </div>
    </div>
  );
}

function flagToSlug(flag: string): string | null {
  const map: Record<string, string> = { hasNotification: "news", hasApplication: "application-process", hasAdmitCard: "admit-card", hasSyllabus: "syllabus", hasAnswerKey: "faqs", hasResult: "result", hasCutoff: "cut-off", hasCounselling: "counselling" };
  return map[flag] ?? null;
}
