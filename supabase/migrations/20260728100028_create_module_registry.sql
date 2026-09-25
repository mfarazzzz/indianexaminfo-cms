
-- =============================================================================
-- MODULE REGISTRY — stores definitions for all content modules (built-in + custom)
-- =============================================================================

CREATE TABLE IF NOT EXISTS module_registry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  type          text NOT NULL CHECK (type IN ('built-in', 'custom')),
  icon          text,
  description   text,
  display_order integer NOT NULL DEFAULT 0,
  fields        jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS module_registry_type_active_order_idx 
  ON module_registry(type, is_active, display_order);

-- RLS
ALTER TABLE module_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_active_modules"
  ON module_registry FOR SELECT
  USING (is_active = true);

CREATE POLICY "staff_read_all_modules"
  ON module_registry FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "staff_write_modules"
  ON module_registry FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "staff_update_modules"
  ON module_registry FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_delete_modules"
  ON module_registry FOR DELETE
  USING (current_user_role() IN ('super-admin', 'admin'));

-- Auto-update updated_at trigger
CREATE TRIGGER set_updated_at 
  BEFORE UPDATE ON module_registry
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- SEED BUILT-IN MODULE DEFINITIONS
-- =============================================================================

INSERT INTO module_registry (slug, name, type, icon, description, display_order, fields) VALUES

('overview', 'Overview', 'built-in', 'file-text', 'General overview and introduction to the exam', 1,
'[{"key":"summary","label":"Summary","type":"textarea","required":false,"placeholder":"Brief 1-2 line summary of the exam"},{"key":"body","label":"Body Content","type":"richtext","required":false,"placeholder":"Write detailed overview..."}]'::jsonb),

('eligibility', 'Eligibility', 'built-in', 'user-check', 'Educational qualifications and eligibility criteria', 2,
'[{"key":"qualification","label":"Educational Qualification","type":"textarea","required":false,"placeholder":"e.g. Graduate with 50% marks"},{"key":"ageLimit","label":"Age Limit","type":"text","required":false,"placeholder":"e.g. No upper age limit"},{"key":"nationality","label":"Nationality","type":"text","required":false,"placeholder":"e.g. Indian / NRI / PIO"},{"key":"attempts","label":"Attempts Allowed","type":"text","required":false,"placeholder":"e.g. No limit"},{"key":"additionalCriteria","label":"Additional Criteria","type":"richtext","required":false,"placeholder":"Any other eligibility details..."}]'::jsonb),

('important-dates', 'Important Dates', 'built-in', 'calendar', 'Key dates and deadlines for the exam cycle', 3,
'[{"key":"dates","label":"Dates","type":"repeater","required":false,"subFields":[{"key":"label","label":"Event Name","type":"text","required":true},{"key":"date","label":"Date","type":"date","required":false},{"key":"isUrgent","label":"Urgent/Upcoming","type":"checkbox","required":false}]}]'::jsonb),

('application-process', 'Application Process', 'built-in', 'clipboard-list', 'How to apply, step-by-step instructions', 4,
'[{"key":"description","label":"Process Description","type":"richtext","required":false,"placeholder":"Overview of the application process..."},{"key":"steps","label":"Steps","type":"repeater","required":false,"subFields":[{"key":"title","label":"Step Title","type":"text","required":true},{"key":"description","label":"Description","type":"textarea","required":false},{"key":"image","label":"Screenshot/Image","type":"image","required":false}]},{"key":"applyLink","label":"Apply Online Link","type":"url","required":false,"placeholder":"https://..."},{"key":"fee","label":"Application Fee Details","type":"richtext","required":false}]'::jsonb),

('exam-pattern', 'Exam Pattern', 'built-in', 'layout-grid', 'Exam structure, sections, marks, and duration', 5,
'[{"key":"mode","label":"Exam Mode","type":"text","required":false,"placeholder":"e.g. Online CBT"},{"key":"duration","label":"Duration","type":"text","required":false,"placeholder":"e.g. 3 hours"},{"key":"totalMarks","label":"Total Marks","type":"number","required":false},{"key":"markingScheme","label":"Marking Scheme","type":"text","required":false,"placeholder":"e.g. +4 / -1"},{"key":"sections","label":"Sections","type":"repeater","required":false,"subFields":[{"key":"name","label":"Section Name","type":"text","required":true},{"key":"questions","label":"No. of Questions","type":"number","required":false},{"key":"marks","label":"Marks","type":"number","required":false},{"key":"duration","label":"Duration","type":"text","required":false}]},{"key":"notes","label":"Additional Notes","type":"richtext","required":false}]'::jsonb),

('syllabus', 'Syllabus', 'built-in', 'book-open', 'Subject-wise syllabus and topics', 6,
'[{"key":"subjects","label":"Subjects","type":"repeater","required":false,"subFields":[{"key":"name","label":"Subject Name","type":"text","required":true},{"key":"topics","label":"Topics & Content","type":"richtext","required":false}]},{"key":"downloadLink","label":"Syllabus PDF Link","type":"url","required":false},{"key":"notes","label":"Preparation Notes","type":"richtext","required":false}]'::jsonb),

('faqs', 'FAQs', 'built-in', 'help-circle', 'Frequently asked questions and answers', 7,
'[{"key":"items","label":"FAQ Items","type":"repeater","required":false,"subFields":[{"key":"question","label":"Question","type":"text","required":true},{"key":"answer","label":"Answer","type":"richtext","required":true}]}]'::jsonb),

('admit-card', 'Admit Card', 'built-in', 'id-card', 'Admit card download information and instructions', 8,
'[{"key":"releaseDate","label":"Release Date","type":"date","required":false},{"key":"downloadLink","label":"Download Link","type":"url","required":false,"placeholder":"https://..."},{"key":"body","label":"Instructions","type":"richtext","required":false,"placeholder":"How to download admit card, what to check..."},{"key":"documents","label":"Documents Required","type":"textarea","required":false,"placeholder":"List documents to bring to exam center"}]'::jsonb),

('result', 'Result', 'built-in', 'trophy', 'Result declaration details and scorecard', 9,
'[{"key":"declarationDate","label":"Declaration Date","type":"date","required":false},{"key":"checkLink","label":"Check Result Link","type":"url","required":false,"placeholder":"https://..."},{"key":"body","label":"Result Details","type":"richtext","required":false,"placeholder":"How to check result, what the scorecard contains..."},{"key":"statistics","label":"Key Statistics","type":"textarea","required":false,"placeholder":"Total appeared, qualified, pass percentage etc."}]'::jsonb),

('cut-off', 'Cut-off', 'built-in', 'bar-chart-2', 'Category-wise cutoff marks and trends', 10,
'[{"key":"body","label":"Cutoff Details","type":"richtext","required":false,"placeholder":"Category-wise cutoff marks, trends..."},{"key":"categories","label":"Category Cutoffs","type":"repeater","required":false,"subFields":[{"key":"category","label":"Category","type":"text","required":true,"placeholder":"e.g. General, OBC, SC, ST"},{"key":"cutoff","label":"Cutoff Score","type":"text","required":false},{"key":"year","label":"Year","type":"text","required":false}]},{"key":"notes","label":"Additional Notes","type":"richtext","required":false}]'::jsonb),

('counselling', 'Counselling', 'built-in', 'users', 'Counselling process, rounds, and seat allocation', 11,
'[{"key":"body","label":"Process Description","type":"richtext","required":false,"placeholder":"Overview of counselling process..."},{"key":"officialLink","label":"Official Counselling Portal","type":"url","required":false},{"key":"rounds","label":"Counselling Rounds","type":"repeater","required":false,"subFields":[{"key":"name","label":"Round Name","type":"text","required":true},{"key":"date","label":"Date","type":"date","required":false},{"key":"description","label":"Description","type":"textarea","required":false}]},{"key":"documents","label":"Required Documents","type":"richtext","required":false}]'::jsonb),

('news', 'News & Updates', 'built-in', 'newspaper', 'Exam-specific news and latest updates', 12,
'[{"key":"items","label":"News Items","type":"repeater","required":false,"subFields":[{"key":"title","label":"Title","type":"text","required":true},{"key":"date","label":"Date","type":"date","required":false},{"key":"summary","label":"Summary","type":"textarea","required":false},{"key":"body","label":"Full Content","type":"richtext","required":false},{"key":"featureImage","label":"Feature Image","type":"image","required":false}]}]'::jsonb);
;
