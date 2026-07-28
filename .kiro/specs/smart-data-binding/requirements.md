# Requirements: Content Module Auto-Population & Smart Data Binding

## Introduction

This feature eliminates duplicate data entry by making content modules data-driven. Instead of requiring editors to manually copy information from Dates, Identity, SEO, and News tabs into content modules, the system automatically populates module content from existing structured data. Each module supports three data modes: Automatic (default), Hybrid (auto + manual notes), and Manual Override. AI generation is available per-module. The frontend renders the same structured data directly — no duplicate content layer.

## Requirements

### Requirement 1: Data Mode System

**User Story:** As a CMS editor, I want each content module to support Automatic, Hybrid, and Manual modes so that I can choose how content is generated.

#### Acceptance Criteria
1. Each module SHALL support three data modes: `auto`, `hybrid`, `manual`.
2. `auto` mode SHALL populate content entirely from bound source data (Dates tab, Identity, SEO, News).
3. `hybrid` mode SHALL show auto-populated data PLUS allow editors to add supplementary notes below.
4. `manual` mode SHALL ignore all automatic binding and show only user-entered content.
5. The default mode for all modules SHALL be `auto`.
6. Mode selection SHALL be persisted per-module per-edition in `content_modules._config.modes`.

### Requirement 2: Overview Module Auto-Generation

**User Story:** As a CMS editor, I want the Overview module to auto-generate from Identity, Dates, and other structured data so I don't write it manually.

#### Acceptance Criteria
1. In `auto` mode, the Overview module SHALL generate content from: exam name, short name, conducting body, official website, status, category, edition year, important dates (next 3 upcoming), eligibility summary, and application fee.
2. The auto-generated overview SHALL be formatted as readable HTML with sections.
3. WHEN source data (Identity, Dates, Eligibility) changes, the overview SHALL regenerate automatically within the same save operation.
4. In `manual` mode, the overview SHALL show only the rich text editor with no auto-generation.
5. In `hybrid` mode, the auto-generated overview SHALL display as read-only above an editable "Additional Notes" rich text field.

### Requirement 3: Important Dates Module — Direct Binding

**User Story:** As a CMS editor, I want the Important Dates module to pull directly from the Dates tab so I never enter dates twice.

#### Acceptance Criteria
1. The Important Dates module SHALL NOT have its own date entry form.
2. It SHALL display dates directly from `exam_editions.important_dates` (the Dates tab data).
3. Only dates with non-empty date values SHALL be displayed.
4. The module SHALL only offer an Enable/Disable toggle — no content editing.
5. WHEN the Dates tab is updated and saved, the Important Dates module SHALL reflect changes immediately without any manual sync action.

### Requirement 4: FAQs Module — SEO Tab Binding

**User Story:** As a CMS editor, I want FAQs to auto-populate from the SEO tab's FAQ entries so I don't duplicate FAQ content.

#### Acceptance Criteria
1. In `auto` mode, the FAQs module SHALL pull FAQ items directly from `exams.faqs` (the SEO tab data).
2. Editors SHALL be able to: Regenerate (AI), Edit individual FAQs, Delete, Add Custom FAQ, Pin FAQ (pinned FAQs always show first).
3. In `hybrid` mode, SEO tab FAQs appear as "Auto" items (read-only) and editors can add "Custom" items below.
4. In `manual` mode, the module SHALL show only manually entered FAQs (ignoring SEO tab).
5. AI Regenerate SHALL call the AI to generate new FAQs based on exam context and replace the auto items.

### Requirement 5: News Module — News Tab Binding

**User Story:** As a CMS editor, I want the News module to display news from the News tab automatically so I don't copy news entries.

#### Acceptance Criteria
1. The News module SHALL NOT have its own news entry form.
2. It SHALL display news items from the News tab's content data (`content_modules.news` existing data).
3. The module SHALL only offer an Enable/Disable toggle.
4. WHEN news is added/edited/deleted in the News tab, the module SHALL reflect changes immediately.

### Requirement 6: AI Fill Per-Module

**User Story:** As a CMS editor, I want to trigger AI content generation for individual modules so I can selectively generate content.

#### Acceptance Criteria
1. Each content module SHALL have an "AI Fill" button visible in its header when expanded.
2. AI Fill for Overview SHALL generate a summary from structured exam data.
3. AI Fill for Eligibility SHALL generate eligibility criteria from the exam's context.
4. AI Fill for Application Process SHALL generate step-by-step instructions.
5. AI Fill for Exam Pattern SHALL generate pattern details from known exam data.
6. AI Fill for Syllabus SHALL generate subject-wise topics.
7. AI Fill SHALL respect the current data mode — in `auto` mode it regenerates the auto content; in `manual` mode it fills the manual fields.
8. A global "AI Fill All Modules" action SHALL exist that triggers AI Fill for all enabled modules sequentially.

### Requirement 7: Smart Synchronization

**User Story:** As a CMS editor, I want to know when module data is stale and sync it with one click.

#### Acceptance Criteria
1. Each auto/hybrid module SHALL track a `lastSyncedAt` timestamp.
2. WHEN source data is newer than `lastSyncedAt`, the module SHALL show a "Stale" indicator (amber dot).
3. A "Sync Now" button SHALL re-pull/regenerate content from source data.
4. Manual overrides SHALL never be overwritten by sync operations.
5. A "Reset to Auto" action SHALL discard manual content and switch back to auto mode.
6. The Module Panel header SHALL show count of stale modules (e.g., "3 modules need sync").

### Requirement 8: Module Controls

**User Story:** As a CMS editor, I want comprehensive controls for each module.

#### Acceptance Criteria
1. Each module SHALL support: Enable/Disable, Reorder (drag-and-drop), Collapse/Expand.
2. Each module header SHALL show: data mode selector (auto/hybrid/manual), AI Fill button, Sync Now (if stale), and a kebab menu.
3. The kebab menu SHALL contain: Preview, Reset to Auto, Duplicate (custom only), Delete (custom only).
4. A "Collapse All" / "Expand All" toggle SHALL exist in the Module Panel header.
5. Auto-populated content SHALL be visually distinct from manually entered content (e.g., subtle background tint or badge).

### Requirement 9: Frontend Single Source of Truth

**User Story:** As a frontend visitor, I want to see the latest data without editors needing to update multiple places.

#### Acceptance Criteria
1. The frontend SHALL render Important Dates directly from `exam_editions.important_dates` — NOT from content_modules.
2. The frontend SHALL render FAQs from `exams.faqs` when the FAQs module is in auto/hybrid mode.
3. The frontend SHALL render News from the news data in content_modules when the News module is enabled.
4. The frontend SHALL render Overview from auto-generated content stored in content_modules (cached on save).
5. WHEN any source tab is saved (Dates, Identity, SEO, News), the frontend cache SHALL be revalidated.
