import React from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { FieldRenderer } from "../FieldRenderer";
import type { FieldDefinition } from "@/types/modules";

interface Props {
  field: FieldDefinition;
  value: Record<string, unknown>[];
  onChange: (value: Record<string, unknown>[]) => void;
  error?: string;
}

export function RepeaterFieldEditor({ field, value, onChange, error }: Props) {
  const items = Array.isArray(value) ? value : [];
  const subFields = field.subFields ?? [];

  const addItem = () => {
    const newItem: Record<string, unknown> = {};
    for (const sf of subFields) {
      newItem[sf.key] = sf.defaultValue ?? (sf.type === "checkbox" ? false : "");
    }
    onChange([...items, newItem]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, key: string, val: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [key]: val };
    onChange(updated);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-slate-600">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-slate-400 italic py-2">No entries yet. Click "Add" to start.</p>
      )}

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="border border-slate-200 rounded p-3 bg-slate-50/50 relative group">
            <div className="flex items-start gap-2">
              <div className="pt-1 text-slate-300 cursor-grab">
                <GripVertical size={14} />
              </div>
              <div className="flex-1 space-y-2">
                {subFields.map((sf) => (
                  <FieldRenderer
                    key={sf.key}
                    field={sf}
                    value={item[sf.key]}
                    onChange={(val) => updateItem(index, sf.key, val)}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
