import React from "react";
import { RichEditor } from "@/components/shared/RichEditor";
import type { FieldDefinition } from "@/types/modules";

interface Props {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function RichTextFieldEditor({ field, value, onChange, error }: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <RichEditor
        content={value ?? ""}
        onChange={onChange}
        placeholder={field.placeholder || "Start writing..."}
        minHeight={180}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
