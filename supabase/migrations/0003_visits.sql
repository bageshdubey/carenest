-- Next doctor visit. A date found on a photo waits for the child's check, like a new medicine list.
-- The scheduler reminds the parent the evening before (dinner time) and the morning of the visit (breakfast time).
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  visit_date date not null,
  visit_time text,
  doctor text,
  source text not null check (source in ('child','photo')),
  status text not null default 'pending' check (status in ('pending','confirmed')),
  evening_sent_at timestamptz,
  morning_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index visits_family_idx on public.visits (family_id, visit_date);
alter table public.visits enable row level security;
create policy "own rows" on public.visits for all using (public.owns_family(family_id)) with check (public.owns_family(family_id));
