/**
 * ModuleContentEditor — Renders field editors for a module based on its schema.
 * Connects to useModuleAutosave for debounced persistence.
 */
import React, { useCallback, useEffect, useState } from "react";
import { FieldRenderer } from "@/components/entity-editor/modules/FieldRenderer";
import { useModuleAutosave } from "@/hooks/useModuleAutosave";
import type { FieldDefinition, ModuleContentData, SaveStatus } from "@/types/modules";

interface Props {
  editionId: string | null;
  moduleSlug: string;
  fields: FieldDefinition[];
  initialContent: ModuleContentData | null;
  onStatusChange?: (status: SaveStatus) => void;
}

export function ModuleContentEditor({ editionId, moduleSlug, fields, initialContent, onStatusChange }: Props) {
  const [content, setContent] = useState<Record<string, unknown>>(() => {
    if (!initialContent) return {};
    const { _meta, ...rest } = initialContent;
    return rest;
  });

  const { scheduleAutosave, status } = useModuleAutosave(editionId, moduleSlug);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const handleFieldChange = useCallback((key: string, value: unknown) => {
    setContent((prev) => {
      const updated = { ...prev, [key]: value };
      scheduleAutosave(updated);
      return updated;
    });
  }, [scheduleAutosave]);

  return (
    <div className="space-y-4 py-3">
      {fields.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={content[field.key]}
          onChange={(val) => handleFieldChange(field.key, val)}
        />
      ))}
      {fields.length === 0 && (
        <p className="text-xs text-slate-400 italic">No fields defined for this module.</p>
      )}
    </div>
  );
}
