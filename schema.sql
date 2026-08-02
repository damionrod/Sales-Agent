create extension if not exists "pgcrypto";

create type lead_status as enum ('new','qualified','email_ready','approved','sent','replied','held','rejected');

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

create policy "Authenticated users manage companies" on companies for all to authenticated using (true) with check (true);
create policy "Authenticated users manage contacts" on contacts for all to authenticated using (true) with check (true);
create policy "Authenticated users manage drafts" on email_drafts for all to authenticated using (true) with check (true);
create policy "Authenticated users manage suppressions" on suppression_list for all to authenticated using (true) with check (true);
