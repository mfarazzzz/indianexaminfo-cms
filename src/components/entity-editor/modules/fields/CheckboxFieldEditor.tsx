import React from "react";
import type { FieldDefinition } from "@/types/modules";

interface Props {
  field: FieldDefinition;
  value: boolean;
  onChange: (value: boolean) => void;
  error?: string;
}

export function CheckboxFieldEditor({ field, value, onChange, error }: Props) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={value ?? false}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-slate-300"
        />
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
