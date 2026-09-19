import React, { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { FieldDefinition } from "@/types/modules";
import { validateField } from "@/lib/fields/fieldTypes";

interface Props {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function UrlFieldEditor({ field, value, onChange, error }: Props) {
  // Validation-only (this pass): typing stays free; on blur we run the shared
  // `url` field type and show what's wrong. We do NOT rewrite the saved value.
  const [typeError, setTypeError] = useState<string | null>(null);

  const handleBlur = () => {
    const res = validateField("url", value ?? "");
    setTypeError(res.ok ? null : res.error ?? null);
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={value ?? ""}
          onChange={(e) => { onChange(e.target.value); if (typeError) setTypeError(null); }}
          onBlur={handleBlur}
          placeholder={field.placeholder || "https://..."}
          className="flex-1 rounded border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {value && (
          <a href={value} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600" title="Open link">
            <ExternalLink size={14} />
          </a>
        )}
      </div>
      {(error || typeError) && <p className="text-xs text-red-500 mt-1">{error ?? typeError}</p>}
    </div>
  );
}
