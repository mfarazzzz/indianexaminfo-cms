
-- Step 2: Migrate pillar values in all tables

-- exams: sarkari-naukri → government-exam
UPDATE exams SET pillar = 'government-exam' WHERE pillar = 'sarkari-naukri';

-- exams: sarkari-bharti → govt-vacancy
UPDATE exams SET pillar = 'govt-vacancy' WHERE pillar = 'sarkari-bharti';

-- exams: board-university → board-exam
UPDATE exams SET pillar = 'board-exam' WHERE pillar = 'board-university';

-- categories: same migrations
UPDATE categories SET pillar = 'government-exam' WHERE pillar = 'sarkari-naukri';
UPDATE categories SET pillar = 'govt-vacancy' WHERE pillar = 'sarkari-bharti';
UPDATE categories SET pillar = 'board-exam' WHERE pillar = 'board-university';

-- content_posts: migrate any with old pillar values
UPDATE content_posts SET pillar = 'government-exam' WHERE pillar = 'sarkari-naukri';
UPDATE content_posts SET pillar = 'govt-vacancy' WHERE pillar = 'sarkari-bharti';
UPDATE content_posts SET pillar = 'board-exam' WHERE pillar = 'board-university';

-- taxonomy_nodes: migrate if any exist
UPDATE taxonomy_nodes SET pillar = 'government-exam' WHERE pillar = 'sarkari-naukri';
UPDATE taxonomy_nodes SET pillar = 'govt-vacancy' WHERE pillar = 'sarkari-bharti';
UPDATE taxonomy_nodes SET pillar = 'board-exam' WHERE pillar = 'board-university';
;
