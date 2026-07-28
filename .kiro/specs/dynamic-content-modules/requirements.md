# Requirements Document

## Introduction

This feature replaces the current split "Modules" tab (checkboxes) and "Content" tab (limited step-by-step guides) with a unified dynamic content module system. Each exam edition gets a set of built-in modules with dedicated rich editors, plus the ability to create custom modules with configurable field schemas. The frontend auto-renders all modules without template updates. All module data is stored in the existing `exam_editions.content_modules` jsonb column.

## Glossary

- **Module_Registry**: The central configuration that defines all available content modules (both built-in and custom), including their field schemas, display order, and metadata.
- **Content_Module**: A named section of content associated with an exam edition (e.g., Overview, Eligibility, Syllabus). Each module has a type, field schema, and content data.
- **Built_In_Module**: A predefined content module shipped with the CMS that has a fixed field schema tailored to its purpose (e.g., Important Dates uses a date repeater, Exam Pattern uses a table editor).
- **Custom_Module**: A user-created content module whose field schema is defined at runtime by the administrator through the CMS interface.
- **Field_Schema**: A JSON-based definition of fields within a module, specifying each field's type, label, validation rules, and ordering.
- **Module_Panel**: The unified CMS interface combining module enable/disable toggles with inline content editing for each module.
- **Field_Renderer**: A component that dynamically renders the appropriate editor widget (rich text, table, date picker, repeater, etc.) based on a field schema definition.
- **Auto_Renderer**: The frontend system that reads module configuration and content data from the database and renders appropriate UI components without hardcoded templates.
- **Repeater_Field**: A field type that allows adding multiple entries of a sub-schema (e.g., multiple FAQ items, multiple date entries).
- **Edition**: A temporal instance of an exam (e.g., "JEE Main 2025 Session 1") stored in `exam_editions`.

## Requirements

### Requirement 1: Unified Module Panel

**User Story:** As a CMS administrator, I want a single interface to enable/disable modules and edit their content, so that I do not need to switch between separate tabs.

#### Acceptance Criteria

1. WHEN the administrator opens an exam edition editor, THE Module_Panel SHALL display all available modules in a single scrollable list with enable/disable toggles and expandable content editors.
2. WHEN the administrator toggles a module to enabled, THE Module_Panel SHALL expand the module section and display its content editor fields.
3. WHEN the administrator toggles a module to disabled, THE Module_Panel SHALL collapse the module section and retain previously entered content in the database without deletion.
4. THE Module_Panel SHALL display modules in their configured display order with drag-and-drop reordering support.
5. WHEN the administrator reorders modules via drag-and-drop, THE Module_Panel SHALL persist the new display order to the database within 2 seconds.

### Requirement 2: Built-In Module Editors

**User Story:** As a CMS administrator, I want dedicated rich editors for each built-in module type, so that I can enter structured content with the appropriate field types for each section.

#### Acceptance Criteria

1. THE Module_Registry SHALL include the following built-in modules: Overview, Eligibility, Important Dates, Application Process, Exam Pattern, Syllabus, FAQs, Admit Card, Result, Cut-off, Counselling, and News.
2. WHEN the administrator edits the Overview module, THE Field_Renderer SHALL display a rich text editor (TipTap-based) for the body content and a text field for a summary.
3. WHEN the administrator edits the Eligibility module, THE Field_Renderer SHALL display structured fields for educational qualification, age limit, nationality, and a rich text field for additional criteria.
4. WHEN the administrator edits the Important Dates module, THE Field_Renderer SHALL display a Repeater_Field with date label, date value, and urgency flag sub-fields.
5. WHEN the administrator edits the Application Process module, THE Field_Renderer SHALL display a rich text editor for process description and a Repeater_Field for step-by-step instructions with step number, title, description, and optional image.
6. WHEN the administrator edits the Exam Pattern module, THE Field_Renderer SHALL display a table editor for subjects, marks, duration, and question counts, plus a rich text field for additional notes.
7. WHEN the administrator edits the Syllabus module, THE Field_Renderer SHALL display a Repeater_Field for subjects, each containing a title and a rich text field for topic content.
8. WHEN the administrator edits the FAQs module, THE Field_Renderer SHALL display a Repeater_Field with question (text) and answer (rich text) sub-fields.
9. WHEN the administrator edits the Admit Card, Result, or Cut-off modules, THE Field_Renderer SHALL display a rich text editor for body content, a date field for the release date, and a URL field for the direct link.
10. WHEN the administrator edits the Counselling module, THE Field_Renderer SHALL display a rich text editor for process description, a Repeater_Field for rounds with round name and date, and a URL field for the official link.
11. WHEN the administrator edits the News module, THE Field_Renderer SHALL display a Repeater_Field for news items with title, date, summary (text), and body (rich text) sub-fields.

### Requirement 3: Custom Module Creation

**User Story:** As a CMS administrator, I want to create new content modules without code changes, so that I can add new types of structured content as exam requirements evolve.

#### Acceptance Criteria

1. WHEN the administrator clicks "Add Custom Module," THE Module_Panel SHALL display a creation form with fields for module name, slug (auto-generated from name), icon selection, and description.
2. THE Module_Panel SHALL validate that the custom module slug is unique within the Module_Registry and contains only lowercase alphanumeric characters and hyphens.
3. WHEN the administrator defines the field schema for a custom module, THE Module_Panel SHALL allow adding fields of the following types: Text, Textarea, Rich Text, Number, Date, Select, Checkbox, Radio, Image, File Upload, URL, and Repeater.
4. WHEN the administrator adds a Repeater field to a custom module schema, THE Module_Panel SHALL allow defining sub-fields within the repeater using any of the non-Repeater field types.
5. WHEN the administrator saves a custom module definition, THE Module_Registry SHALL persist the field schema to the database and make the module immediately available for all exam editions.
6. WHEN the administrator edits an existing custom module schema, THE Module_Panel SHALL preserve all previously entered content data and migrate field values where the field key is unchanged.

### Requirement 4: Module Content Persistence

**User Story:** As a CMS administrator, I want all module content saved reliably to the database, so that content is never lost between editing sessions.

#### Acceptance Criteria

1. WHEN the administrator edits content within any module, THE Module_Panel SHALL autosave changes to the `exam_editions.content_modules` jsonb column within 3 seconds of the last keystroke.
2. THE Module_Panel SHALL display a save status indicator showing one of: "Saving," "Saved," or "Save failed."
3. IF an autosave operation fails due to a network error, THEN THE Module_Panel SHALL retry the save operation up to 3 times with exponential backoff and display an error notification after all retries are exhausted.
4. THE Module_Panel SHALL store content data for each module keyed by module slug within the `content_modules` jsonb object (e.g., `content_modules.overview`, `content_modules.eligibility`).
5. WHEN the administrator saves module content, THE Module_Panel SHALL include a `_meta` property within each module's data containing `updatedAt` timestamp and `updatedBy` user identifier.

### Requirement 5: Module Management Operations

**User Story:** As a CMS administrator, I want to duplicate, delete, and manage modules, so that I can efficiently organize content structure.

#### Acceptance Criteria

1. WHEN the administrator duplicates a module, THE Module_Panel SHALL create a copy of the module with its content data, append "(Copy)" to the display name, and assign the next available display order.
2. WHEN the administrator deletes a custom module from the registry, THE Module_Panel SHALL display a confirmation dialog warning that the module definition and all associated content across editions will be permanently removed.
3. WHEN the administrator confirms deletion of a custom module, THE Module_Registry SHALL remove the module definition and THE Module_Panel SHALL remove the corresponding content key from all `exam_editions.content_modules` entries.
4. THE Module_Panel SHALL prevent deletion of built-in modules from the Module_Registry.
5. WHEN the administrator duplicates module content within an edition, THE Module_Panel SHALL deep-copy all field values including repeater entries and rich text content.

### Requirement 6: Frontend Auto-Rendering

**User Story:** As a frontend visitor, I want to see all enabled module content rendered on exam pages without requiring code deployments for new modules, so that I always have access to the latest content structure.

#### Acceptance Criteria

1. WHEN the frontend loads an exam edition page, THE Auto_Renderer SHALL read the `content_modules` jsonb data and render each enabled module in display order.
2. THE Auto_Renderer SHALL render built-in modules using their dedicated frontend components with appropriate styling and layout.
3. WHEN the Auto_Renderer encounters a custom module, THE Auto_Renderer SHALL read the module's field schema from the Module_Registry and render each field using the corresponding Field_Renderer component (text as paragraph, rich text as HTML, dates formatted for locale, images as responsive figures, URLs as clickable links, repeaters as lists or cards).
4. WHEN a module is disabled for an edition, THE Auto_Renderer SHALL exclude that module from the rendered page output.
5. THE Auto_Renderer SHALL generate anchor links for each rendered module to enable in-page navigation.
6. IF the `content_modules` data contains a module key not present in the Module_Registry, THEN THE Auto_Renderer SHALL skip rendering that module without producing a visible error.

### Requirement 7: Field Schema Validation

**User Story:** As a CMS administrator, I want field-level validation on module content, so that I can ensure data quality before publishing.

#### Acceptance Criteria

1. WHEN a field in the Field_Schema is marked as required, THE Field_Renderer SHALL display a validation error if the field is empty when the administrator attempts to publish the module.
2. WHEN a URL field contains a value, THE Field_Renderer SHALL validate that the value is a well-formed URL with an https scheme.
3. WHEN a Number field has min or max constraints defined in the Field_Schema, THE Field_Renderer SHALL validate the entered value falls within the defined range.
4. WHEN a Date field has a value, THE Field_Renderer SHALL validate that the value is a valid ISO 8601 date string.
5. THE Field_Renderer SHALL display inline validation errors below each invalid field with a descriptive error message.

### Requirement 8: Module Schema Serialization

**User Story:** As a developer, I want a consistent JSON schema format for module definitions, so that the system can reliably parse and render modules.

#### Acceptance Criteria

1. THE Module_Registry SHALL serialize each module definition as a JSON object containing: `slug` (string), `name` (string), `type` ("built-in" or "custom"), `icon` (string), `description` (string), `displayOrder` (integer), `enabled` (boolean), and `fields` (array of field definitions).
2. THE Module_Registry SHALL serialize each field definition as a JSON object containing: `key` (string), `label` (string), `type` (field type enum), `required` (boolean), `defaultValue` (any), `options` (array, for select/radio types), and `validation` (object with type-specific constraints).
3. FOR ALL valid Module_Registry JSON objects, serializing then parsing then serializing SHALL produce an identical JSON string (round-trip property).
4. THE Module_Registry SHALL reject field definitions where the `key` property is empty, contains spaces, or duplicates an existing key within the same module.

### Requirement 9: Migration from Current Modules Tab

**User Story:** As a CMS administrator, I want the existing module toggle data migrated to the new system, so that I do not lose any previously configured module availability settings.

#### Acceptance Criteria

1. WHEN the system migrates existing data, THE Module_Registry SHALL map each legacy boolean field (`hasNotification`, `hasApplication`, `hasAdmitCard`, `hasSyllabus`, `hasAnswerKey`, `hasResult`, `hasCutoff`, `hasCounselling`) to the corresponding built-in module's `enabled` state.
2. WHEN the system migrates existing data, THE Module_Panel SHALL preserve all content previously stored in `content_modules` jsonb under the same keys.
3. WHEN the migration completes, THE Module_Panel SHALL remove the legacy "Modules" tab from the exam edition editor interface.
4. IF a legacy edition has `hasNotification` set to true but no corresponding content in `content_modules`, THEN THE Module_Panel SHALL set the Notification module to enabled with empty content fields.
