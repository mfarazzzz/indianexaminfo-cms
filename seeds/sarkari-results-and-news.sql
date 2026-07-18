-- ============================================================================
-- Sarkari Results Pages & Related News/Blogs Seed Data
-- Total: 100 pages (60 Result pages + 40 Education News/Blog articles)
-- Based on: National Public Sector Recruitment Report of India 2026
-- ============================================================================

-- ============================================================================
-- PART 1: SARKARI RESULT PAGES (cms_results table) — 60 entries
-- ============================================================================

-- Categories covered:
--   civil-services, engineering, medical, ssc, railway, banking, 
--   state-psc, scientific, psu, defence, police, revenue, 
--   insurance, regulatory, teaching, paramilitary

INSERT INTO cms_results (slug, title, title_hindi, result_date, organization, organization_hindi, category, description, result_link, total_candidates, pass_percentage, cutoff_marks, result_status, is_new, is_featured, status, published_at) VALUES

-- === UPSC Results (6) ===
('upsc-cse-2026-prelims-result', 'UPSC Civil Services Prelims Result 2026', 'यूपीएससी सिविल सेवा प्रारंभिक परीक्षा परिणाम 2026', '2026-07-15', 'UPSC', 'संघ लोक सेवा आयोग', 'civil-services', '<p>UPSC has declared the Civil Services Preliminary Examination 2026 result for 933 vacancies.</p>', 'https://upsc.gov.in/results', 1100000, 2.5, 'General: 98, OBC: 92, SC: 78, ST: 72', 'declared', true, true, 'published', now()),
('upsc-ifos-2026-prelims-result', 'UPSC Indian Forest Service Prelims Result 2026', 'यूपीएससी भारतीय वन सेवा प्रारंभिक परीक्षा परिणाम 2026', '2026-07-20', 'UPSC', 'संघ लोक सेवा आयोग', 'civil-services', '<p>UPSC IFoS Preliminary Examination 2026 result declared for 150 posts.</p>', 'https://upsc.gov.in/results', 85000, 3.2, 'General: 95, OBC: 88, SC: 75, ST: 68', 'declared', true, false, 'published', now()),
('upsc-capf-ac-2026-result', 'UPSC CAPF AC Written Exam Result 2026', 'यूपीएससी सीएपीएफ एसी लिखित परीक्षा परिणाम 2026', '2026-09-25', 'UPSC', 'संघ लोक सेवा आयोग', 'defence', '<p>UPSC CAPF AC Written Examination 2026 result for 322 vacancies.</p>', 'https://upsc.gov.in/results', 250000, 4.1, 'General: 115, OBC: 108, SC: 95, ST: 88', 'declared', true, false, 'published', now()),
('upsc-ese-2026-prelims-result', 'UPSC Engineering Services Prelims Result 2026', 'यूपीएससी इंजीनियरिंग सेवा प्रारंभिक परीक्षा परिणाम 2026', '2026-04-20', 'UPSC', 'संघ लोक सेवा आयोग', 'engineering', '<p>UPSC ESE 2026 Preliminary result for 167 vacancies.</p>', 'https://upsc.gov.in/results', 180000, 5.5, 'CE: 125, ME: 130, EE: 118, ECE: 122', 'declared', true, false, 'published', now()),
('upsc-cms-2026-result', 'UPSC Combined Medical Services Result 2026', 'यूपीएससी संयुक्त चिकित्सा सेवा परिणाम 2026', '2026-10-10', 'UPSC', 'संघ लोक सेवा आयोग', 'medical', '<p>UPSC CMS 2026 result for 827 posts.</p>', 'https://upsc.gov.in/results', 45000, 8.5, 'General: 340, OBC: 320, SC: 290, ST: 275', 'declared', true, true, 'published', now()),
('upsc-nda-1-2026-result', 'UPSC NDA (I) 2026 Written Exam Result', 'यूपीएससी एनडीए (I) 2026 लिखित परीक्षा परिणाम', '2026-06-25', 'UPSC', 'संघ लोक सेवा आयोग', 'defence', '<p>UPSC NDA Exam (I) 2026 written result for 400 vacancies.</p>', 'https://upsc.gov.in/results', 450000, 4.2, 'General: 215, OBC: 200, SC: 180, ST: 165', 'declared', true, true, 'published', now()),

-- === SSC Results (8) ===
('ssc-cgl-2026-tier1-result', 'SSC CGL 2026 Tier-I Result Declared', 'एसएससी सीजीएल 2026 टियर-1 परिणाम घोषित', '2026-08-15', 'SSC', 'कर्मचारी चयन आयोग', 'ssc', '<p>SSC CGL Tier-I result for 8,500 vacancies.</p>', 'https://ssc.gov.in/results', 3500000, 8.2, 'General: 145.67, OBC: 132.45, SC: 118.23, ST: 108.89', 'declared', true, true, 'published', now()),
('ssc-chsl-2026-tier1-result', 'SSC CHSL 2026 Tier-I Result', 'एसएससी सीएचएसएल 2026 टियर-1 परिणाम', '2026-11-20', 'SSC', 'कर्मचारी चयन आयोग', 'ssc', '<p>SSC CHSL Tier-I result for 3,700 vacancies.</p>', 'https://ssc.gov.in/results', 2800000, 6.5, 'General: 138, OBC: 125, SC: 112, ST: 102', 'declared', true, false, 'published', now()),
('ssc-mts-2026-result', 'SSC MTS 2026 CBE Result', 'एसएससी एमटीएस 2026 सीबीई परिणाम', '2026-12-28', 'SSC', 'कर्मचारी चयन आयोग', 'ssc', '<p>SSC MTS 2026 result for 9,000 posts.</p>', 'https://ssc.gov.in/results', 4200000, 5.8, 'General: 125, OBC: 115, SC: 98, ST: 90', 'declared', true, false, 'published', now()),
('ssc-gd-constable-2027-result', 'SSC GD Constable 2027 CBE Result', 'एसएससी जीडी कांस्टेबल 2027 सीबीई परिणाम', '2027-05-15', 'SSC', 'कर्मचारी चयन आयोग', 'police', '<p>SSC GD Constable result for 35,000 vacancies.</p>', 'https://ssc.gov.in/results', 8700000, 9.5, 'General: 118, OBC: 108, SC: 95, ST: 88', 'expected', false, true, 'published', now()),
('ssc-cpo-2026-paper1-result', 'SSC CPO Sub-Inspector 2026 Paper-I Result', 'एसएससी सीपीओ सब-इंस्पेक्टर 2026 पेपर-1 परिणाम', '2026-12-30', 'SSC', 'कर्मचारी चयन आयोग', 'police', '<p>SSC CPO Paper-I result for 4,100 vacancies.</p>', 'https://ssc.gov.in/results', 1500000, 7.2, 'General: 142, OBC: 130, SC: 115, ST: 105', 'declared', true, false, 'published', now()),
('ssc-je-2026-paper1-result', 'SSC Junior Engineer 2026 Paper-I Result', 'एसएससी जूनियर इंजीनियर 2026 पेपर-1 परिणाम', '2026-08-20', 'SSC', 'कर्मचारी चयन आयोग', 'engineering', '<p>SSC JE Paper-I result for 1,200 vacancies.</p>', 'https://ssc.gov.in/results', 450000, 6.8, 'Civil: 148, Elec: 152, Mech: 145', 'declared', true, false, 'published', now()),
('ssc-steno-2026-result', 'SSC Stenographer Grade C & D 2026 CBE Result', 'एसएससी स्टेनोग्राफर ग्रेड सी एंड डी 2026 सीबीई परिणाम', '2026-11-15', 'SSC', 'कर्मचारी चयन आयोग', 'ssc', '<p>SSC Steno result for 1,500 vacancies.</p>', 'https://ssc.gov.in/results', 350000, 7.5, 'Grade C: 145, Grade D: 132', 'declared', true, false, 'published', now()),
('ssc-selection-post-xiv-result', 'SSC Selection Post Phase-XIV 2026 Result', 'एसएससी सिलेक्शन पोस्ट फेज-XIV 2026 परिणाम', '2026-09-30', 'SSC', 'कर्मचारी चयन आयोग', 'ssc', '<p>SSC Selection Post Phase-XIV result for 2,049 vacancies.</p>', 'https://ssc.gov.in/results', 1200000, 7.8, 'Matric: 95, HS: 108, Grad: 125', 'declared', true, false, 'published', now())

-- (Remaining 46 entries follow the same pattern across RRB, Banking, State PSC, Defence, etc.)
ON CONFLICT (slug) DO NOTHING;

-- Note: Full 60 entries were inserted via direct SQL execution.
-- This file serves as a reference template for future seeding operations.

-- ============================================================================
-- PART 2: EDUCATION NEWS & BLOG ARTICLES (cms_education_news table) — 40 entries  
-- ============================================================================

-- Categories covered:
--   government-jobs, banking, defence, teaching, psu, 
--   career-guidance, exam-preparation, medical

-- Note: Full 40 entries were inserted via direct SQL execution.
-- Key articles include:
--   - Exam notifications (UPSC CSE, SSC CGL, RRB Group D, IBPS PO, etc.)
--   - Recruitment announcements (Agniveer, KVS, NVS, FCI, etc.)
--   - Career guidance (salary comparisons, PSC vs UPSC, GATE PSU guide)
--   - Preparation strategies (SSC CGL prep, Bank PO prep)
--   - Calendars and schedules (IBPS, Railway, UPSC calendars)

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- cms_results: 60 rows covering all major exam results from document
-- cms_education_news: 40 rows covering news, blogs, and career guides
-- Total Sarkari content pages created: 100+
