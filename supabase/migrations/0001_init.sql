-- CareNest schema. Run once in Supabase: SQL Editor > New query > paste > Run.
-- The web app reads with the signed-in child's session (row-level security).
-- The WhatsApp webhook and the scheduler use the service role key on the server.

create extension if not exists pgcrypto;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  child_name text not null,
  child_phone text,                       -- digits with country code, e.g. 919876543210
  child_lang text not null default 'en' check (child_lang in ('en','hi')),
  parent_call_name text not null,
  parent_phone text not null,
  parent_lang text not null default 'en' check (parent_lang in ('en','hi','mr')),
  meal_b text not null default '08:30',
  meal_l text not null default '13:30',
  meal_d text not null default '20:30',
  link_code text not null unique,
  parent_linked_at timestamptz,
  last_parent_message_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index families_owner_idx on public.families(owner_id);
create index families_parent_phone_idx on public.families(parent_phone);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  photo_path text,
  source text not null check (source in ('parent','child')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  doctor text,
  rx_date text,
  extracted jsonb,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  prescription_id uuid references public.prescriptions(id) on delete set null,
  name text not null,
  strength text not null default '',
  quantity text not null default '1 tablet',
  meals text[] not null default '{}',
  food text not null default 'after' check (food in ('before','after','any')),
  purpose jsonb,                          -- {"en": "...", "hi": "...", "mr": "..."}
  purpose_source text not null default 'none' check (purpose_source in ('prescription','suggested','none')),
  needs_check boolean not null default false,
  active boolean not null default false,  -- true only after the child approves
  created_at timestamptz not null default now()
);
create index medicines_family_idx on public.medicines(family_id, active);

create table public.doses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  dose_date date not null,
  meal text not null check (meal in ('b','l','d')),
  status text not null default 'sent' check (status in ('sent','taken','missed')),
  sent_at timestamptz not null default now(),
  taken_at timestamptz,
  unique (family_id, dose_date, meal)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  photo_path text,
  lab text,
  report_date text,
  created_at timestamptz not null default now()
);

create table public.report_values (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  test text not null,
  value_text text not null,
  value_number double precision,
  unit text,
  range_text text,
  range_low double precision,
  range_high double precision,
  flag text not null check (flag in ('high','low','in_range','unknown')),
  what_it_measures jsonb
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  wa_from text,
  body text not null,
  wa_message_id text,
  created_at timestamptz not null default now()
);
create index messages_family_idx on public.messages(family_id, created_at desc);
create unique index messages_wa_id_idx on public.messages(wa_message_id) where direction = 'in';

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('new_list','dose_missed','report_out_of_range','advice_question','emergency')),
  severity text not null default 'check' check (severity in ('check','urgent')),
  detail jsonb,
  sent_to_whatsapp boolean not null default false,
  created_at timestamptz not null default now()
);
create index alerts_family_idx on public.alerts(family_id, created_at desc);

-- Row-level security: a signed-in child sees only their own family.
alter table public.families enable row level security;
alter table public.prescriptions enable row level security;
alter table public.medicines enable row level security;
alter table public.doses enable row level security;
alter table public.reports enable row level security;
alter table public.report_values enable row level security;
alter table public.messages enable row level security;
alter table public.alerts enable row level security;

create policy "own family" on public.families
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.owns_family(fid uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.families f where f.id = fid and f.owner_id = auth.uid()) $$;

create policy "own rows" on public.prescriptions for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
create policy "own rows" on public.medicines for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
create policy "own rows" on public.doses for select using (public.owns_family(family_id));
create policy "own rows" on public.reports for select using (public.owns_family(family_id));
create policy "own rows" on public.report_values for select using (
  exists (select 1 from public.reports r where r.id = report_id and public.owns_family(r.family_id)));
create policy "own rows" on public.messages for select using (public.owns_family(family_id));
create policy "own rows" on public.alerts for select using (public.owns_family(family_id));

-- Private bucket for prescription and report photos. Only the server writes; the child reads their own.
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false) on conflict do nothing;
create policy "own uploads" on storage.objects for select
  using (bucket_id = 'uploads' and public.owns_family(((storage.foldername(name))[1])::uuid));
