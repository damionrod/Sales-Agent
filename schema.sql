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

-- Editable Symbio service catalogue
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'Other',
  description text,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists services_active_order_idx on services(active desc, sort_order asc, name asc);
alter table services enable row level security;
do $$ begin
  create policy "Authenticated users manage services" on services for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

insert into services (name, category, description, active, sort_order) values
('Australian DIDs / Virtual Numbers','Voice & Numbering','Local Australian geographic and virtual numbers for platforms, carriers and communications providers.',true,10),
('New Zealand DIDs / Virtual Numbers','Voice & Numbering','Local New Zealand geographic and virtual numbers.',true,20),
('Singapore DIDs / Virtual Numbers','Voice & Numbering','Local Singapore business and virtual numbers.',true,30),
('Australian Mobile Numbers','Mobile','Australian mobile numbering for supported wholesale use cases.',true,40),
('Number Porting','Voice & Numbering','Porting of eligible numbers between providers.',true,50),
('Inbound Voice','Voice & Numbering','Inbound voice connectivity and call delivery.',true,60),
('Call Termination','Voice & Numbering','Domestic and international wholesale call termination.',true,70),
('SIP Trunks / Wholesale Voice','Voice & Numbering','Wholesale SIP and carrier voice connectivity.',true,80),
('A2P SMS','Messaging','Application-to-person business messaging.',true,90),
('Two-way SMS','Messaging','Inbound and outbound conversational SMS.',true,100),
('MVNO Enablement Australia','Mobile','Wholesale enablement for brands launching an Australian MVNO.',true,110),
('eSIMs','Mobile','eSIM connectivity for supported consumer and enterprise use cases.',true,120),
('IoT SIMs','Mobile','Cellular connectivity for connected devices, telemetry and IoT deployments.',true,130),
('DIA','Data & Connectivity','Dedicated Internet Access for business and wholesale customers.',true,140),
('NBN / Enterprise Ethernet','Data & Connectivity','Australian NBN and enterprise access services.',true,150),
('OptiComm','Data & Connectivity','OptiComm access services where available.',true,160),
('IP Transit','Data & Connectivity','Wholesale internet transit and routing connectivity.',true,170),
('Backhaul','Data & Connectivity','Carrier and data-centre backhaul connectivity.',true,180),
('Dark Fibre','Data & Connectivity','Dedicated dark fibre connectivity where available.',true,190),
('NuWave BYOC','Cloud & Carrier','Carrier connectivity for supported NuWave BYOC deployments.',true,200)
on conflict (name) do nothing;
