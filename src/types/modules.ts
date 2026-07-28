/**
 * modules.ts — Type definitions for the Dynamic Content Modules system.
 *
 * Used by:
 * - Module Registry service (CRUD for module definitions)
 * - Module Panel UI (CMS editor)
 * - Field Renderer (schema-driven field editors)
 * - Frontend Auto-Renderer (dynamic section rendering)
 */

// ── Field Types ────────────────────────────────────────────────────────────

export type FieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "date"
  | "select"
  | "checkbox"
  | "radio"
  | "image"
  | "file"
  | "url"
  | "repeater";

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  options?: FieldOption[];
  validation?: FieldValidation;
  subFields?: FieldDefinition[];
}

// ── Module Types ───────────────────────────────────────────────────────────

export type ModuleType = "built-in" | "custom";

export interface ModuleDefinition {
  id: string;
  slug: string;
  name: string;
  type: ModuleType;
  icon: string;
  description: string;
  displayOrder: number;
  fields: FieldDefinition[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
}

// ── Content Module Data ────────────────────────────────────────────────────

export interface ModuleMeta {
  updatedAt: string;
  updatedBy: string;
}

export interface ModuleContentData {
  _meta?: ModuleMeta;
  [key: string]: unknown;
}

export interface ModuleConfig {
  moduleOrder: string[];
  enabledModules: string[];
  modes?: Record<string, string>;
  syncTimestamps?: Record<string, string>;
}

export interface ContentModulesData {
  _config?: ModuleConfig;
  [moduleSlug: string]: ModuleContentData | ModuleConfig | undefined;
}

// ── Autosave Status ────────────────────────────────────────────────────────

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// ── Built-in Module Slugs ──────────────────────────────────────────────────

export const BUILT_IN_MODULE_SLUGS = [
  "overview",
  "eligibility",
  "important-dates",
  "application-process",
  "exam-pattern",
  "syllabus",
  "faqs",
  "admit-card",
  "result",
  "cut-off",
  "counselling",
  "news",
] as const;

export type BuiltInModuleSlug = (typeof BUILT_IN_MODULE_SLUGS)[number];

// ── Legacy Flag Mapping ────────────────────────────────────────────────────

/** Maps legacy edition boolean flags to their corresponding module slugs */
export const LEGACY_FLAG_TO_MODULE: Record<string, string> = {
  hasNotification: "news",
  hasApplication: "application-process",
  hasAdmitCard: "admit-card",
  hasSyllabus: "syllabus",
  hasAnswerKey: "faqs", // answer key info typically in FAQs or overview
  hasResult: "result",
  hasCutoff: "cut-off",
  hasCounselling: "counselling",
};
