import React from "react";
import type { FieldDefinition } from "@/types/modules";

interface Props {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function RadioFieldEditor({ field, value, onChange, error }: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="flex flex-wrap gap-4">
        {(field.options ?? []).map((opt) => (
          <label key={opt.value} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="radio"
              name={field.key}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="border-slate-300"
            />
            {opt.label}
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
