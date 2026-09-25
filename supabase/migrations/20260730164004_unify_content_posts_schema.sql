
-- ============================================================================
-- MIGRATION: Unify content_posts, blog_posts, and cms_education_news
-- into a single content_posts table.
--
-- Strategy: Extend content_posts with fields from blog_posts and cms_education_news,
-- then migrate data FROM those tables INTO content_posts.
-- Original tables are preserved (not dropped) for safety.
-- ============================================================================

-- Step 1: Add content_type enum values for blog/news content
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'article';
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'news';
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'guide';
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'opinion';
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'blog';

-- Step 2: Add new columns to content_posts for blog/news functionality
ALTER TABLE content_posts 
  ADD COLUMN IF NOT EXISTS section text,
  ADD COLUMN IF NOT EXISTS post_type text,
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES blog_authors(id),
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS reading_time integer,
  ADD COLUMN IF NOT EXISTS word_count integer,
  ADD COLUMN IF NOT EXISTS shares integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_breaking boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS table_of_contents jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS related_exam_slugs text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_link text,
  ADD COLUMN IF NOT EXISTS title_hindi text,
  ADD COLUMN IF NOT EXISTS excerpt_hindi text,
  ADD COLUMN IF NOT EXISTS content_hindi text,
  ADD COLUMN IF NOT EXISTS migrated_from text;

-- Step 3: Add section check constraint
ALTER TABLE content_posts ADD CONSTRAINT content_posts_section_check 
  CHECK (section IS NULL OR section = ANY(ARRAY[
    'education-news', 'exam-prep', 'career-guidance', 'scholarship', 
    'study-abroad', 'edtech', 'student-life', 'opinion',
    'board-results', 'university-admissions', 'government-jobs',
    'banking', 'defence', 'psu', 'teaching', 'medical'
  ]));

-- Step 4: Add post_type check constraint
ALTER TABLE content_posts ADD CONSTRAINT content_posts_post_type_check
  CHECK (post_type IS NULL OR post_type = ANY(ARRAY[
    'news', 'article', 'guide', 'listicle', 'opinion', 
    'interview', 'analysis', 'how-to', 'notification-update'
  ]));

-- Step 5: Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_content_posts_section ON content_posts(section) WHERE section IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_posts_post_type ON content_posts(post_type) WHERE post_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_posts_content_type ON content_posts(content_type);
CREATE INDEX IF NOT EXISTS idx_content_posts_status_published ON content_posts(status, published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_content_posts_is_breaking ON content_posts(is_breaking) WHERE is_breaking = true;
CREATE INDEX IF NOT EXISTS idx_content_posts_is_featured ON content_posts(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_content_posts_author ON content_posts(author_id) WHERE author_id IS NOT NULL;
;
