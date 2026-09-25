
create table if not exists media (
  id            uuid primary key default gen_random_uuid(),
  filename      text not null,
  original_name text not null,
  url           text not null,
  thumbnail_url text,
  mime_type     text not null,
  size          bigint not null,
  width         integer,
  height        integer,
  alt_text      text,
  folder        text not null default 'general',
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists media_folder_idx on media(folder);

create table if not exists advertisers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  name           text not null,
  company_name   text,
  email          text,
  phone          text,
  gst_number     text,
  contact_person text,
  status         advertiser_status not null default 'active',
  total_spend    numeric(12,2) not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists ad_zones (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  size           text not null,
  position       text not null,
  page_placement text not null,
  description    text,
  is_active      boolean not null default true,
  fallback_html  text,
  created_at     timestamptz not null default now()
);

create table if not exists ad_campaigns (
  id                uuid primary key default gen_random_uuid(),
  advertiser_id     uuid not null references advertisers(id) on delete cascade,
  name              text not null,
  type              text check (type in ('display','sponsored-post','category-takeover')),
  status            campaign_status not null default 'draft',
  budget_total      numeric(12,2) not null default 0,
  budget_spent      numeric(12,2) not null default 0,
  budget_daily      numeric(12,2) not null default 0,
  billing_type      billing_type,
  rate              numeric(10,4) not null default 0,
  impressions       bigint not null default 0,
  clicks            bigint not null default 0,
  ctr               numeric(6,4) not null default 0,
  start_date        date,
  end_date          date,
  target_zones      text[] not null default '{}',
  target_categories text[] not null default '{}',
  notes             text,
  approved_by       uuid references auth.users(id) on delete set null,
  approved_at       timestamptz,
  rejection_reason  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null
);
create index if not exists ad_campaigns_advertiser_id_idx on ad_campaigns(advertiser_id);
create index if not exists ad_campaigns_status_idx        on ad_campaigns(status);

create table if not exists ad_creatives (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  name        text not null,
  type        text check (type in ('image','html','text-link')),
  image_url   text,
  html_code   text,
  link_url    text not null,
  alt_text    text,
  size        text,
  is_active   boolean not null default true,
  impressions bigint not null default 0,
  clicks      bigint not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists ad_reports (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  date        date not null,
  impressions bigint not null default 0,
  clicks      bigint not null default 0,
  ctr         numeric(6,4) not null default 0,
  spend       numeric(12,2) not null default 0,
  zone_id     uuid references ad_zones(id) on delete set null,
  page        text,
  unique (campaign_id, date, zone_id)
);

create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  user_name   text not null,
  user_role   text not null,
  action      text not null,
  entity_type text,
  entity_id   text,
  entity_name text,
  details     jsonb not null default '{}'::jsonb,
  ip_address  text,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_user_id_idx     on audit_log(user_id);
create index if not exists audit_log_created_at_idx  on audit_log(created_at desc);
;
