import React from "react";
import { ExternalLink } from "lucide-react";
import type { FieldDefinition } from "@/types/modules";

interface Props {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function UrlFieldEditor({ field, value, onChange, error }: Props) {
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
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "https://..."}
          className="flex-1 rounded border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {value && (
          <a href={value} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600" title="Open link">
            <ExternalLink size={14} />
          </a>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
