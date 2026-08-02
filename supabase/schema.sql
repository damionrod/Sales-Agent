create extension if not exists "pgcrypto";

do $$ begin
  create type lead_status as enum ('new','qualified','email_ready','approved','sent','replied','held','rejected');
exception when duplicate_object then null;
end $$;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  country text,
  industry text,
  employees text,
  opportunity text,
  products text[] default '{}',
  signal text,
  research text,
  score integer check (score between 0 and 100),
  status lead_status not null default 'new',
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists companies_website_unique on companies ((lower(website))) where website is not null;
create index if not exists companies_status_idx on companies(status);
create index if not exists companies_score_idx on companies(score desc);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  title text,
  email text,
  linkedin text,
  confidence text check (confidence in ('Verified','Likely','Unknown')),
  relevance integer check (relevance between 0 and 100),
  reason text,
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists contacts_company_idx on contacts(company_id);

create table if not exists email_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  subject text,
  body text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists drafts_company_idx on email_drafts(company_id);

create table if not exists suppression_list (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  domain text,
  reason text,
  created_at timestamptz not null default now()
);

alter table companies enable row level security;
alter table contacts enable row level security;
alter table email_drafts enable row level security;
alter table suppression_list enable row level security;

do $$ begin
  create policy "Authenticated users manage companies" on companies for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Authenticated users manage contacts" on contacts for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Authenticated users manage drafts" on email_drafts for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Authenticated users manage suppressions" on suppression_list for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Background lead discovery jobs
create table if not exists search_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign text not null default 'voice',
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  stage text not null default 'Waiting to start',
  progress integer not null default 0 check (progress between 0 and 100),
  maximum_leads integer not null default 3,
  results_per_query integer not null default 3,
  searched_results integer not null default 0,
  candidate_companies integer not null default 0,
  qualified_leads integer not null default 0,
  error text,
  result_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists search_jobs_created_idx on search_jobs(created_at desc);
alter table search_jobs enable row level security;
do $$ begin
  create policy "Authenticated users manage search jobs" on search_jobs for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
