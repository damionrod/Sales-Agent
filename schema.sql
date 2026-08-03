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

-- Background jobs for the automatic lead → contact → email pipeline
create table if not exists search_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queued' check (status in ('queued','running','complete','failed')),
  stage text not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  message text,
  error text,
  campaign text,
  requested_leads integer not null default 5,
  auto_contacts boolean not null default true,
  auto_email boolean not null default true,
  searched_results integer not null default 0,
  candidate_companies integer not null default 0,
  qualified_leads integer not null default 0,
  contacts_found integer not null default 0,
  emails_generated integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists search_jobs_created_idx on search_jobs(created_at desc);
alter table search_jobs enable row level security;
do $$ begin
  create policy "Authenticated users manage search jobs" on search_jobs for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Lead categorisation migration
alter table companies add column if not exists lead_category text not null default 'other';
create index if not exists companies_lead_category_idx on companies(lead_category);

-- Automatic pipeline migration for projects that already had search_jobs
alter table search_jobs add column if not exists message text;
alter table search_jobs add column if not exists requested_leads integer not null default 5;
alter table search_jobs add column if not exists auto_contacts boolean not null default true;
alter table search_jobs add column if not exists auto_email boolean not null default true;
alter table search_jobs add column if not exists contacts_found integer not null default 0;
alter table search_jobs add column if not exists emails_generated integer not null default 0;

-- Permit both earlier and automatic-pipeline completion status values.
alter table search_jobs drop constraint if exists search_jobs_status_check;
alter table search_jobs add constraint search_jobs_status_check check (status in ('queued','running','complete','completed','failed'));
notify pgrst, 'reload schema';

-- Contact phone fields
alter table contacts add column if not exists phone text;
alter table contacts add column if not exists phone_type text;
alter table contacts add column if not exists company_phone text;

-- Editable services catalogue
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Other',
  description text,
  active boolean not null default true,
  include_in_all boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists services_name_unique on services ((lower(name)));
alter table services enable row level security;
do $$ begin
  create policy "Authenticated users manage services" on services for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

insert into services (name,category,description,active,include_in_all,sort_order) values
('Virtual Numbers / DIDs','Voice & Numbering','AU, NZ and Singapore virtual numbers and DIDs',true,true,1),
('Call Termination','Voice & Numbering','Inbound and outbound call termination in AU, NZ and Singapore',true,true,2),
('Australian Mobile Numbers','Mobile','Australian mobile numbering and porting',true,true,3),
('A2P / Two-way SMS','Messaging','A2P, transactional and two-way SMS',true,true,4),
('MVNO Enablement','Mobile','Australian MVNO and mobile wholesale enablement',true,true,5),
('eSIMs','Mobile','eSIM connectivity and enablement',true,true,6),
('IoT SIMs','Mobile','IoT and connected-device SIM connectivity',true,true,7),
('DIA / NBN / OptiComm','Data','Dedicated internet, NBN and OptiComm connectivity',true,true,8),
('IP Transit / Backhaul / Dark Fibre','Data','IP transit, backhaul and dark fibre',true,true,9),
('NuWave BYOC','Cloud & Carrier','NuWave BYOC and carrier interconnect opportunities',true,true,10)
on conflict do nothing;
notify pgrst, 'reload schema';
