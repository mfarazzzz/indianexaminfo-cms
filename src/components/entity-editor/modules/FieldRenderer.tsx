/**
 * FieldRenderer — Pure mapping component that renders the appropriate
 * field editor based on a FieldDefinition's type.
 */
import React from "react";
import type { FieldDefinition } from "@/types/modules";
import { TextFieldEditor } from "./fields/TextFieldEditor";
import { TextareaFieldEditor } from "./fields/TextareaFieldEditor";
import { RichTextFieldEditor } from "./fields/RichTextFieldEditor";
import { NumberFieldEditor } from "./fields/NumberFieldEditor";
import { DateFieldEditor } from "./fields/DateFieldEditor";
import { SelectFieldEditor } from "./fields/SelectFieldEditor";
import { CheckboxFieldEditor } from "./fields/CheckboxFieldEditor";
import { RadioFieldEditor } from "./fields/RadioFieldEditor";
import { ImageFieldEditor } from "./fields/ImageFieldEditor";
import { FileFieldEditor } from "./fields/FileFieldEditor";
import { UrlFieldEditor } from "./fields/UrlFieldEditor";
import { RepeaterFieldEditor } from "./fields/RepeaterFieldEditor";

interface Props {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}

export function FieldRenderer({ field, value, onChange, error }: Props) {
  switch (field.type) {
    case "text":
      return <TextFieldEditor field={field} value={value as string} onChange={onChange} error={error} />;

    case "textarea":
      return <TextareaFieldEditor field={field} value={value as string} onChange={onChange} error={error} />;

    case "richtext":
      return <RichTextFieldEditor field={field} value={value as string} onChange={onChange} error={error} />;

    case "number":
      return <NumberFieldEditor field={field} value={value as number | string} onChange={onChange as (v: number | null) => void} error={error} />;

    case "date":
      return <DateFieldEditor field={field} value={value as string} onChange={onChange} error={error} />;

    case "select":
      return <SelectFieldEditor field={field} value={value as string} onChange={onChange} error={error} />;

    case "checkbox":
      return <CheckboxFieldEditor field={field} value={value as boolean} onChange={onChange as (v: boolean) => void} error={error} />;

    case "radio":
      return <RadioFieldEditor field={field} value={value as string} onChange={onChange} error={error} />;

    case "image":
      return <ImageFieldEditor field={field} value={value as string} onChange={onChange} error={error} />;

    case "file":
      return <FileFieldEditor field={field} value={value as string} onChange={onChange} error={error} />;

    case "url":
      return <UrlFieldEditor field={field} value={value as string} onChange={onChange} error={error} />;

    case "repeater":
      return <RepeaterFieldEditor field={field} value={value as Record<string, unknown>[]} onChange={onChange as (v: Record<string, unknown>[]) => void} error={error} />;

    default:
      return (
        <div className="text-xs text-slate-400 italic">
          Unsupported field type: {field.type}
        </div>
      );
  }
}
