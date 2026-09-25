
create extension if not exists "pgcrypto";

create type pillar_type as enum ('sarkari-naukri', 'entrance-exam', 'board-university');
create type exam_status as enum ('upcoming', 'active', 'registration-open', 'registration-closed', 'result-declared', 'completed', 'ongoing');
create type entity_type as enum ('exam', 'board', 'university', 'recruitment');
create type content_type as enum ('notification', 'application', 'admit-card', 'date-sheet', 'syllabus', 'answer-key', 'result', 'cutoff', 'previous-papers', 'mock-test', 'study-material', 'books');
create type post_status as enum ('draft', 'review', 'published', 'unpublished');
create type blog_section as enum ('education-news', 'exam-prep', 'career-guidance', 'scholarship', 'study-abroad', 'edtech', 'student-life', 'opinion');
create type post_type as enum ('news', 'article', 'guide', 'listicle', 'opinion', 'interview', 'analysis', 'how-to');
create type billing_type as enum ('CPM', 'CPC', 'flat-rate');
create type campaign_status as enum ('draft', 'pending-review', 'active', 'paused', 'completed', 'rejected');
create type advertiser_status as enum ('active', 'inactive', 'suspended');
create type page_status as enum ('draft', 'published');

create table if not exists roles (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  is_system   boolean not null default false
);

create table if not exists permissions (
  id    uuid primary key default gen_random_uuid(),
  slug  text not null unique,
  label text not null,
  "group" text not null
);

create table if not exists role_permissions (
  role_id       uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);
;
