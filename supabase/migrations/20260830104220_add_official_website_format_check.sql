ALTER TABLE exams
  ADD CONSTRAINT exams_official_website_valid
  CHECK (
    official_website = ''
    OR official_website IS NULL
    OR (official_website ~ '^https?://' AND official_website !~ '[[:space:],]')
  );;
