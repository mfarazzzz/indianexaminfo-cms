/**
 * registerInspectors.ts — Registers all inspector definitions.
 * Called once at app initialization (alongside initializeModuleRegistry).
 */
import { registerInspector } from './inspectorRegistry'
import {
  GeneralInspector, TimelineInspector, SEOInspector,
  LinksInspector, RelationshipsInspector, AmendmentsInspector,
  PublishingInspector, HealthInspector, VerificationInspector,
  SimpleInspector,
} from './modules'

export function initializeInspectorRegistry(): void {
  registerInspector({ moduleKey: 'general',           component: GeneralInspector,       widgets: [], actions: [] })
  registerInspector({ moduleKey: 'timeline',          component: TimelineInspector,      widgets: [], actions: [] })
  registerInspector({ moduleKey: 'eligibility',       component: SimpleInspector,        widgets: [], actions: [] })
  registerInspector({ moduleKey: 'vacancy',           component: SimpleInspector,        widgets: [], actions: [] })
  registerInspector({ moduleKey: 'fee',               component: SimpleInspector,        widgets: [], actions: [] })
  registerInspector({ moduleKey: 'exam_pattern',      component: SimpleInspector,        widgets: [], actions: [] })
  registerInspector({ moduleKey: 'selection_process', component: SimpleInspector,        widgets: [], actions: [] })
  registerInspector({ moduleKey: 'syllabus',          component: SimpleInspector,        widgets: [], actions: [] })
  registerInspector({ moduleKey: 'modules',           component: SimpleInspector,        widgets: [], actions: [] })
  registerInspector({ moduleKey: 'downloads',         component: SimpleInspector,        widgets: [], actions: [] })
  registerInspector({ moduleKey: 'links',             component: LinksInspector,         widgets: [], actions: [] })
  registerInspector({ moduleKey: 'media',             component: SimpleInspector,        widgets: [], actions: [] })
  registerInspector({ moduleKey: 'seo',               component: SEOInspector,           widgets: [], actions: [] })
  registerInspector({ moduleKey: 'relationships',     component: RelationshipsInspector, widgets: [], actions: [] })
  registerInspector({ moduleKey: 'amendments',        component: AmendmentsInspector,    widgets: [], actions: [] })
  registerInspector({ moduleKey: 'publishing',        component: PublishingInspector,     widgets: [], actions: [] })
  registerInspector({ moduleKey: 'verification',      component: VerificationInspector,  widgets: [], actions: [] })
  registerInspector({ moduleKey: 'health',            component: HealthInspector,        widgets: [], actions: [] })
  registerInspector({ moduleKey: 'overview',          component: SimpleInspector,        widgets: [], actions: [] })
}
