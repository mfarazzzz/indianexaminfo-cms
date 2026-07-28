/**
 * ModulePanel — Unified content module editing interface.
 *
 * Replaces the old "Modules" tab (checkboxes) and "Content" tab.
 * Displays all available modules with enable/disable toggles and
 * expandable inline content editors for each module.
 */
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ModulePanelHeader } from "./ModulePanelHeader";
import { ContentModuleCard } from "./ContentModuleCard";
import { getModuleRegistry } from "@/services/moduleRegistryService";
import { getContentModules, saveModuleConfig, toggleModuleEnabled } from "@/services/moduleContentService";
import { BUILT_IN_MODULES } from "@/lib/modules/builtInSchemas";
import type { ModuleDefinition, ModuleConfig, ContentModulesData, ModuleContentData, SaveStatus } from "@/types/modules";
import { getErrorMessage } from "@/lib/utils";

interface Props {
  editionId: string | null;
  /** Legacy has_* flags for initial migration */
  legacyFlags?: Record<string, boolean>;
}

export function ModulePanel({ editionId, legacyFlags }: Props) {
  const [modules, setModules] = useState<ModuleDefinition[]>([]);
  const [contentModules, setContentModules] = useState<ContentModulesData>({});
  const [config, setConfig] = useState<ModuleConfig>({ moduleOrder: [], enabledModules: [] });
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});

  const aggregateStatus: SaveStatus = Object.values(statuses).includes("saving")
    ? "saving"
    : Object.values(statuses).includes("error")
      ? "error"
      : Object.values(statuses).includes("saved")
        ? "saved"
        : "idle";

  const lastSavedAt = Object.values(statuses).includes("saved") ? new Date().toISOString() : null;

  useEffect(() => {
    loadData();
  }, [editionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    try {
      let registry: ModuleDefinition[];
      try {
        registry = await getModuleRegistry();
      } catch {
        registry = BUILT_IN_MODULES;
      }
      setModules(registry);

      if (editionId) {
        const data = await getContentModules(editionId);
        setContentModules(data);

        const existingConfig = (data._config as ModuleConfig) ?? null;
        if (existingConfig && existingConfig.moduleOrder.length > 0) {
          setConfig(existingConfig);
        } else {
          const enabledFromLegacy = legacyFlags
            ? Object.entries(legacyFlags)
                .filter(([, v]) => v)
                .map(([k]) => flagToSlug(k))
                .filter(Boolean) as string[]
            : [];

          const defaultOrder = registry.map((m) => m.slug);
          const newConfig: ModuleConfig = {
            moduleOrder: defaultOrder,
            enabledModules: enabledFromLegacy.length > 0 ? enabledFromLegacy : [],
          };
          setConfig(newConfig);
          if (editionId) {
            saveModuleConfig(editionId, newConfig).catch(() => {});
          }
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
    setConfig((prev) => {
      const newEnabled = enabled
        ? [...prev.enabledModules.filter((s) => s !== slug), slug]
        : prev.enabledModules.filter((s) => s !== slug);
      return { ...prev, enabledModules: newEnabled };
    });
    try {
      const updated = await toggleModuleEnabled(editionId, slug, enabled);
      setConfig(updated);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setConfig((prev) => {
        const reverted = enabled
          ? prev.enabledModules.filter((s) => s !== slug)
          : [...prev.enabledModules, slug];
        return { ...prev, enabledModules: reverted };
      });
    }
  }, [editionId]);

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
    for (const mod of modules) {
      if (!seen.has(mod.slug)) ordered.push(mod);
    }
    return ordered;
  }, [modules, config.moduleOrder]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!editionId) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-400">Save the exam first to enable content modules.</p>
      </div>
    );
  }

  return (
    <div>
      <ModulePanelHeader aggregateStatus={aggregateStatus} lastSavedAt={lastSavedAt} />
      <p className="text-xs text-slate-500 mb-4">
        Toggle modules on/off and expand to edit content. Changes are saved automatically.
      </p>
      <div className="space-y-2">
        {orderedModules.map((mod) => (
          <ContentModuleCard
            key={mod.slug}
            module={mod}
            enabled={config.enabledModules.includes(mod.slug)}
            editionId={editionId}
            content={(contentModules[mod.slug] as ModuleContentData) ?? null}
            onToggle={(enabled) => handleToggle(mod.slug, enabled)}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>
    </div>
  );
}

function flagToSlug(flag: string): string | null {
  const map: Record<string, string> = {
    hasNotification: "news",
    hasApplication: "application-process",
    hasAdmitCard: "admit-card",
    hasSyllabus: "syllabus",
    hasAnswerKey: "faqs",
    hasResult: "result",
    hasCutoff: "cut-off",
    hasCounselling: "counselling",
  };
  return map[flag] ?? null;
}
