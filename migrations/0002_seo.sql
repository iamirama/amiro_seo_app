create table if not exists scans (
  id text primary key,
  target_url text not null,
  host text not null,
  status text not null,
  config_json text not null,
  progress_json text not null default '{}',
  queue_json text not null default '[]',
  seen_json text not null default '[]',
  skipped_json text not null default '[]',
  robots_json text,
  sitemap_json text,
  scores_json text,
  coverage int not null default 0,
  summary text,
  validation_json text,
  external_json text,
  psi_json text,
  ai_summary text,
  error text,
  page_count int not null default 0,
  created_at text not null,
  updated_at text not null,
  finished_at text
);

create index if not exists scans_created_idx on scans (created_at desc);

create table if not exists scan_pages (
  id serial primary key,
  scan_id text not null references scans (id) on delete cascade,
  url text not null,
  data_json text not null
);

create unique index if not exists scan_pages_url_idx on scan_pages (scan_id, url);

create table if not exists scan_issues (
  id text primary key,
  scan_id text not null references scans (id) on delete cascade,
  severity text not null,
  category text not null,
  status text not null default 'open',
  priority int not null default 0,
  data_json text not null
);

create index if not exists scan_issues_scan_idx on scan_issues (scan_id);
