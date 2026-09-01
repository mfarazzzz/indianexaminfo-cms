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
import type { SelectionModel } from "@/types/selection";
import { isModuleApplicable } from "@/config/moduleRegistry";
import { getErrorMessage } from "@/lib/utils";
import { hasData, SECTION_BY_SLUG, type HasDataView } from "@/lib/sectionRegistry";
import { DraggableList } from "@/components/shared/DraggableList";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";

/**
 * Map a CMS module-registry slug to the frontend section slug that governs its
 * live visibility. Most match 1:1; a few module slugs differ from section slugs.
 */
const MODULE_SLUG_TO_SECTION: Record<string, string> = {
  // application-process is now a registry section slug in its own right (was
  // renamed from how-to-apply); only vacancy-details still differs.
  "vacancy-details": "vacancy",
};

/**
 * Group classification — MUST match what the frontend actually renders
 * (EntityDetailPage). Verified against TAB_ONLY_MODULES + ContentModulesBlock:
 *  - Group C (tab-only): render on their own sub-page, NOT the main page, so no
 *    main-page order. Matches frontend TAB_ONLY_MODULES.
 *  - Group B (editable, reorderable): render inside the main-page ContentModulesBlock,
 *    ordered by _config.moduleOrder — the ONLY genuinely draggable group.
 * Group A (fixed structure / typed-column tables) is NOT in the module registry;
 * it's a synthetic list below with deep-links to the tab that edits each.
 */
const TAB_ONLY_MODULE_SLUGS = new Set([
  "application-process", "admit-card", "result", "cut-off", "syllabus", "news", "faqs",
]);

/** Fixed page sections (not modules). Each links to the tab where it's edited. */
const FIXED_SECTIONS: { key: string; label: string; sourceTab: string; tabId: string; sectionSlug?: string }[] = [
  { key: "key-highlights",    label: "Key Highlights",     sourceTab: "auto (Dates/Eligibility/Fee)", tabId: "edition" },
  { key: "important-dates-t", label: "Important Dates",    sourceTab: "Dates & Status tab", tabId: "edition", sectionSlug: "important-dates" },
  { key: "eligibility-t",     label: "Eligibility",        sourceTab: "Dates & Status tab", tabId: "edition", sectionSlug: "eligibility" },
  { key: "application-fee-t", label: "Application Fee",     sourceTab: "Dates & Status tab", tabId: "edition", sectionSlug: "application-fee" },
  { key: "selection-t",       label: "Selection Process",  sourceTab: "Identity tab",       tabId: "identity", sectionSlug: "selection-process" },
  { key: "syllabus-t",        label: "Syllabus Highlights", sourceTab: "Identity tab",      tabId: "identity", sectionSlug: "syllabus" },
];

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
  /** Axis 1 — entity type for applicability filtering. Omit = no filtering. */
  entityType?: string;
  /** Axis 2 — selection model for applicability filtering. Omit = no filtering. */
  selectionModel?: SelectionModel;
  /** Group A rows deep-link to the tab that edits them (e.g. "edition", "identity"). */
  onNavigateTab?: (tabId: string) => void;
}

export function ModulePanel({ editionId, exam, edition, legacyFlags, entityType, selectionModel, onNavigateTab }: Props) {
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
      // Filter to modules that are structurally applicable given the two-axis model.
      // When entityType/selectionModel aren't supplied (e.g. older call sites) the
      // filter is a no-op and the full registry is shown — backward compatible.
      if (entityType) {
        registry = registry.filter((m) => isModuleApplicable(m.slug, entityType, selectionModel));
      }
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

  // Group B = main-page modules (reorderable); Group C = tab-only modules.
  const groupBModules = orderedModules.filter((m) => !TAB_ONLY_MODULE_SLUGS.has(m.slug));
  const groupCModules = orderedModules.filter((m) => TAB_ONLY_MODULE_SLUGS.has(m.slug));

  // Real drag: reorder Group B and persist to _config.moduleOrder — the value
  // the frontend main-page ContentModulesBlock actually renders by. Tab-only
  // (Group C) slugs keep their existing relative order appended after.
  const handleReorderGroupB = useCallback((orderedIds: string[]) => {
    if (!editionId) return;
    // orderedIds are module slugs (DraggableList item ids). Rebuild moduleOrder:
    // new Group-B order first, then the untouched tab-only slugs in prior order.
    const tabOnlyInOrder = config.moduleOrder.filter((s) => TAB_ONLY_MODULE_SLUGS.has(s));
    const newOrder = [...orderedIds, ...tabOnlyInOrder];
    const newConfig = { ...config, moduleOrder: newOrder };
    setConfig(newConfig);
    saveModuleConfig(editionId, newConfig).catch((e) => toast.error("Reorder save failed: " + getErrorMessage(e)));
  }, [editionId, config]);

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
        Sections are grouped by how they behave on the live page. Only <span className="font-medium">Editable content modules</span> can be reordered — that order is what the page renders.
      </p>

      {/* ── Group A: Fixed page sections (not modules, not reorderable) ── */}
      <GroupHeading title="Fixed page sections" hint="Always in this position — edit content in the linked tab." />
      <div className="space-y-1.5 mb-5">
        {FIXED_SECTIONS.map((fs) => {
          const live = fs.sectionSlug && liveView && SECTION_BY_SLUG[fs.sectionSlug]
            ? hasData(liveView, fs.sectionSlug) : undefined;
          return (
            <div key={fs.key} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <span className="text-sm text-slate-600 flex-1 min-w-0 truncate">{fs.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 font-medium shrink-0">fixed</span>
              {live === true && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium shrink-0">Live</span>}
              {live === false && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium shrink-0">Hidden — no content yet</span>}
              <button type="button" onClick={() => onNavigateTab?.(fs.tabId)}
                className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline shrink-0">
                Edit in {fs.sourceTab} →
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Group B: Editable content modules (the ONLY reorderable group) ── */}
      <GroupHeading title="Editable content modules" hint="Drag to reorder — this order is what the main page renders." />
      <div className="mb-5">
        {groupBModules.length === 0 ? (
          <p className="text-xs text-slate-400 italic px-1 py-2">No editable modules.</p>
        ) : (
          <DraggableList
            items={groupBModules.map((m) => ({ ...m, id: m.slug }))}
            onReorder={handleReorderGroupB}
            showDefaultHandle={false}
            renderItem={(mod, { dragHandleProps, isDragging }) =>
              renderModuleCard(mod as ModuleDefinition, { dragHandleProps, isDragging })
            }
          />
        )}
      </div>

      {/* ── Group C: Tab-only modules (sub-page, no main-page order) ── */}
      {groupCModules.length > 0 && (
        <>
          <GroupHeading title="Tab-only modules" hint="Shown on their own content-type page, not the main page." />
          <div className="space-y-1.5">
            {groupCModules.map((mod) => renderModuleCard(mod, {}))}
          </div>
        </>
      )}
    </div>
  );

  // Shared card renderer — used by Group B (with drag handle) and Group C (without).
  function renderModuleCard(
    mod: ModuleDefinition,
    { dragHandleProps, isDragging }: { dragHandleProps?: any; isDragging?: boolean }
  ) {
    const mode = getModuleMode(bindingConfig, mod.slug);
    const resolved = resolveModuleContent(mod.slug, mode, exam ?? null, edition ?? null, contentModules);
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
        dragHandleProps={dragHandleProps}
        isDragging={isDragging}
      />
    );
  }
}

function GroupHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <p className="text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}

function flagToSlug(flag: string): string | null {
  const map: Record<string, string> = { hasNotification: "news", hasApplication: "application-process", hasAdmitCard: "admit-card", hasSyllabus: "syllabus", hasAnswerKey: "faqs", hasResult: "result", hasCutoff: "cut-off", hasCounselling: "counselling" };
  return map[flag] ?? null;
}
