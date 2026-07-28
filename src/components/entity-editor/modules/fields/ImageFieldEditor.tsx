import React from "react";
import { ImageUploader } from "@/components/shared/ImageUploader";
import type { FieldDefinition } from "@/types/modules";

interface Props {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function ImageFieldEditor({ field, value, onChange, error }: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <ImageUploader
        value={value ?? ""}
        onChange={onChange}
        folder="media"
        label="Upload Image"
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
