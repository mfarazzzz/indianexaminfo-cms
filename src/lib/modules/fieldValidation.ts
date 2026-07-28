/**
 * fieldValidation.ts — Validation logic for module field values.
 *
 * Used by FieldRenderer components to validate content on blur/change
 * and by ModuleContentEditor for publish-time full validation.
 */
import type { FieldDefinition } from "@/types/modules";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const URL_REGEX = /^https:\/\/.+\..+/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a single field value against its definition.
 */
export function validateField(field: FieldDefinition, value: unknown): ValidationResult {
  // Required check
  if (field.required) {
    if (value === undefined || value === null || value === "") {
      return { valid: false, error: `${field.label} is required` };
    }
    if (field.type === "richtext" && typeof value === "string") {
      const stripped = value.replace(/<[^>]*>/g, "").trim();
      if (!stripped) return { valid: false, error: `${field.label} is required` };
    }
    if (field.type === "repeater" && Array.isArray(value) && value.length === 0) {
      return { valid: false, error: `At least one ${field.label} entry is required` };
    }
  }

  // Skip further validation if empty and not required
  if (value === undefined || value === null || value === "") {
    return { valid: true };
  }

  // Type-specific validation
  switch (field.type) {
    case "url": {
      if (typeof value === "string" && value && !URL_REGEX.test(value)) {
        return { valid: false, error: "Must be a valid https:// URL" };
      }
      break;
    }

    case "date": {
      if (typeof value === "string" && value && !ISO_DATE_REGEX.test(value)) {
        return { valid: false, error: "Must be a valid date (YYYY-MM-DD)" };
      }
      break;
    }

    case "number": {
      const num = typeof value === "number" ? value : Number(value);
      if (isNaN(num)) {
        return { valid: false, error: "Must be a valid number" };
      }
      if (field.validation?.min !== undefined && num < field.validation.min) {
        return { valid: false, error: `Minimum value is ${field.validation.min}` };
      }
      if (field.validation?.max !== undefined && num > field.validation.max) {
        return { valid: false, error: `Maximum value is ${field.validation.max}` };
      }
      break;
    }

    case "text":
    case "textarea": {
      if (typeof value === "string" && field.validation?.max && value.length > field.validation.max) {
        return { valid: false, error: `Maximum ${field.validation.max} characters` };
      }
      if (typeof value === "string" && field.validation?.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          return { valid: false, error: field.validation.message || "Invalid format" };
        }
      }
      break;
    }

    case "select":
    case "radio": {
      if (field.options && field.options.length > 0) {
        const validValues = field.options.map((o) => o.value);
        if (!validValues.includes(value as string)) {
          return { valid: false, error: "Invalid selection" };
        }
      }
      break;
    }

    case "repeater": {
      if (Array.isArray(value) && field.subFields) {
        for (let i = 0; i < value.length; i++) {
          const entry = value[i] as Record<string, unknown>;
          for (const subField of field.subFields) {
            const result = validateField(subField, entry[subField.key]);
            if (!result.valid) {
              return { valid: false, error: `Row ${i + 1}: ${result.error}` };
            }
          }
        }
      }
      break;
    }
  }

  return { valid: true };
}

/**
 * Validate all fields in a module at once (used on publish).
 * Returns an object mapping field keys to error messages.
 */
export function validateModuleContent(
  fields: FieldDefinition[],
  data: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const result = validateField(field, data[field.key]);
    if (!result.valid && result.error) {
      errors[field.key] = result.error;
    }
  }

  return errors;
}
