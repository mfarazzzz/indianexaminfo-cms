
-- 1. Add structured per-content-type data column
ALTER TABLE public.content_posts
  ADD COLUMN IF NOT EXISTS content_type_data JSONB NOT NULL DEFAULT '{}';

-- 2. Add attachment_urls column for PDF/image/external links
ALTER TABLE public.content_posts
  ADD COLUMN IF NOT EXISTS attachment_urls JSONB NOT NULL DEFAULT '[]';

-- 3. Add exam fee columns that were missing display parity
-- (application_fee is already a JSON column in exams, just needs full render)
-- Nothing needed at DB level — data already stored correctly.

-- 4. Add index for content_type_data queries
CREATE INDEX IF NOT EXISTS idx_content_posts_content_type_data 
  ON public.content_posts USING GIN (content_type_data);

COMMENT ON COLUMN public.content_posts.content_type_data IS 
  'Structured fields per content type. Schema varies by content_type:
   notification: {notificationTitle, description, eligibilitySummary, applyLink, notificationPdfUrl}
   admit-card: {admitCardReleaseDate, downloadInstructions, admitCardUrl, credentialsRequired}
   result: {resultDeclaredDate, resultUrl, cutoffApplicable, cutoffDetails, scoreCardUrl}
   answer-key: {keyType, challengeStartDate, challengeEndDate, answerKeyUrl, objectionFee}
   syllabus: {syllabusVersion, syllabusYear, syllabusUrl, subjects}
   application: {applicationStartDate, applicationEndDate, applyOnlineUrl, feeGeneral, feeObc, feeSc, feeSt, feeEws, eligibilitySummary}
   counselling: {registrationStartDate, registrationEndDate, choiceFillingDate, seatAllotmentDate, counsellingUrl, rounds}
   exam-pattern: {subjects, totalMarks, duration, totalQuestions, markingScheme, negativeMarking}
   date-sheet: {examStartDate, examEndDate, dateSheetUrl, subjectSchedule}
   cutoff: {cutoffYear, categoryWiseCutoff, previousYearCutoff}
   previous-papers: {years, paperUrls}
   mock-test: {testUrl, totalTests, freeOrPaid}
   study-material: {materialUrl, subjects, format}
   books: {bookList}';

COMMENT ON COLUMN public.content_posts.attachment_urls IS
  'Array of {label, url, type: "pdf"|"image"|"external", isOfficial} — replaces raw URL pasting in quick_links for non-link attachments';
;
