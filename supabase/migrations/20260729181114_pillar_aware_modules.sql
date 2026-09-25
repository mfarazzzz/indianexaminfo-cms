
-- Add applicable_pillars to module_registry so modules can be filtered per pillar
ALTER TABLE module_registry ADD COLUMN IF NOT EXISTS applicable_pillars text[] DEFAULT '{}';

-- Update existing built-in modules: make them applicable to specific pillars
-- Universal modules (all pillars)
UPDATE module_registry SET applicable_pillars = '{"entrance-exam","sarkari-naukri","sarkari-bharti","board-university"}' 
WHERE slug IN ('overview', 'important-dates', 'faqs', 'news');

-- Entrance exam specific
UPDATE module_registry SET applicable_pillars = '{"entrance-exam"}' 
WHERE slug IN ('eligibility', 'application-process', 'exam-pattern', 'syllabus', 'admit-card', 'result', 'cut-off', 'counselling');

-- Now add Sarkari Naukri specific modules
INSERT INTO module_registry (slug, name, type, icon, description, display_order, fields, applicable_pillars) VALUES
('vacancy-details', 'Vacancy Details', 'built-in', 'users', 'Total posts, category-wise vacancies', 13,
'[{"key":"totalPosts","label":"Total Posts","type":"number","required":false},{"key":"categories","label":"Category-wise Vacancies","type":"repeater","required":false,"subFields":[{"key":"category","label":"Category","type":"text","required":true},{"key":"posts","label":"Posts","type":"number","required":false}]},{"key":"notes","label":"Additional Notes","type":"richtext","required":false}]',
'{"sarkari-naukri","sarkari-bharti"}'),

('salary', 'Salary & Pay Scale', 'built-in', 'banknote', 'Pay matrix, grade pay, allowances', 14,
'[{"key":"payScale","label":"Pay Scale","type":"text","required":false,"placeholder":"e.g. Level 6 (₹35,400-₹1,12,400)"},{"key":"gradePay","label":"Grade Pay","type":"text","required":false},{"key":"inHandSalary","label":"In-Hand Salary (approx)","type":"text","required":false},{"key":"allowances","label":"Allowances","type":"richtext","required":false}]',
'{"sarkari-naukri","sarkari-bharti"}'),

('age-limit', 'Age Limit', 'built-in', 'calendar-clock', 'Age criteria with relaxation details', 15,
'[{"key":"minAge","label":"Minimum Age","type":"number","required":false},{"key":"maxAge","label":"Maximum Age","type":"number","required":false},{"key":"asOnDate","label":"Age as on Date","type":"date","required":false},{"key":"relaxation","label":"Category-wise Relaxation","type":"repeater","required":false,"subFields":[{"key":"category","label":"Category","type":"text","required":true},{"key":"years","label":"Relaxation (years)","type":"number","required":false}]},{"key":"notes","label":"Additional Notes","type":"textarea","required":false}]',
'{"sarkari-naukri","sarkari-bharti"}'),

('selection-process', 'Selection Process', 'built-in', 'list-checks', 'Stages of selection', 16,
'[{"key":"stages","label":"Selection Stages","type":"repeater","required":false,"subFields":[{"key":"name","label":"Stage Name","type":"text","required":true},{"key":"description","label":"Description","type":"textarea","required":false}]},{"key":"notes","label":"Additional Notes","type":"richtext","required":false}]',
'{"sarkari-naukri","sarkari-bharti","entrance-exam"}'),

('documents-required', 'Documents Required', 'built-in', 'file-stack', 'List of required documents', 17,
'[{"key":"documents","label":"Documents","type":"repeater","required":false,"subFields":[{"key":"name","label":"Document Name","type":"text","required":true},{"key":"mandatory","label":"Mandatory","type":"checkbox","required":false}]},{"key":"notes","label":"Additional Instructions","type":"richtext","required":false}]',
'{"sarkari-naukri","sarkari-bharti"}'),

('reservation', 'Reservation Policy', 'built-in', 'shield-check', 'Category-wise reservation details', 18,
'[{"key":"categories","label":"Reservation Categories","type":"repeater","required":false,"subFields":[{"key":"category","label":"Category","type":"text","required":true},{"key":"percentage","label":"Percentage","type":"text","required":false}]},{"key":"notes","label":"Additional Notes","type":"richtext","required":false}]',
'{"sarkari-naukri","sarkari-bharti"}')
ON CONFLICT (slug) DO NOTHING;

-- Board/University specific modules
INSERT INTO module_registry (slug, name, type, icon, description, display_order, fields, applicable_pillars) VALUES
('date-sheet', 'Date Sheet', 'built-in', 'calendar-days', 'Exam schedule and timetable', 19,
'[{"key":"releaseDate","label":"Date Sheet Release Date","type":"date","required":false},{"key":"downloadLink","label":"Download Link","type":"url","required":false},{"key":"schedule","label":"Subject Schedule","type":"repeater","required":false,"subFields":[{"key":"date","label":"Date","type":"date","required":false},{"key":"subject","label":"Subject","type":"text","required":true},{"key":"time","label":"Time","type":"text","required":false}]},{"key":"notes","label":"Additional Notes","type":"richtext","required":false}]',
'{"board-university"}'),

('revaluation', 'Revaluation / Rechecking', 'built-in', 'refresh-cw', 'Revaluation and rechecking process', 20,
'[{"key":"lastDate","label":"Last Date to Apply","type":"date","required":false},{"key":"fee","label":"Revaluation Fee","type":"text","required":false},{"key":"applyLink","label":"Apply Link","type":"url","required":false},{"key":"process","label":"Process","type":"richtext","required":false}]',
'{"board-university"}'),

('practical-exams', 'Practical Exams', 'built-in', 'flask-conical', 'Practical/Lab exam schedule', 21,
'[{"key":"startDate","label":"Start Date","type":"date","required":false},{"key":"endDate","label":"End Date","type":"date","required":false},{"key":"body","label":"Details","type":"richtext","required":false}]',
'{"board-university"}'),

('sample-papers', 'Sample Papers / Model Papers', 'built-in', 'file-text', 'Practice papers and model question papers', 22,
'[{"key":"papers","label":"Papers","type":"repeater","required":false,"subFields":[{"key":"title","label":"Paper Title","type":"text","required":true},{"key":"year","label":"Year","type":"text","required":false},{"key":"downloadLink","label":"Download Link","type":"url","required":false}]},{"key":"notes","label":"Preparation Tips","type":"richtext","required":false}]',
'{"board-university"}')
ON CONFLICT (slug) DO NOTHING;

-- Make entrance-exam modules also available to sarkari-naukri where relevant
UPDATE module_registry SET applicable_pillars = array_cat(applicable_pillars, '{"sarkari-naukri","sarkari-bharti"}')
WHERE slug IN ('eligibility', 'application-process', 'admit-card', 'result');

UPDATE module_registry SET applicable_pillars = array_cat(applicable_pillars, '{"board-university"}')
WHERE slug IN ('eligibility', 'admit-card', 'result', 'cut-off', 'syllabus');
;
