import React from "react";
import type { FieldDefinition } from "@/types/modules";

interface Props {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function TextareaFieldEditor({ field, value, onChange, error }: Props) {
  const maxLen = field.validation?.max;
  const currentLen = (value ?? "").length;

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
      />
      <div className="flex justify-between mt-0.5">
        {error && <p className="text-xs text-red-500">{error}</p>}
        {maxLen && <span className="text-xs text-slate-400 ml-auto">{currentLen}/{maxLen}</span>}
      </div>
    </div>
  );
}
