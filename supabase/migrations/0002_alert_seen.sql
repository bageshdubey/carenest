-- Lets the child hide an alert with "Got it". The alert stays in the Alerts tab as history.
-- Only the server marks alerts seen (after checking the family), so the row-level rules stay read-only.
alter table public.alerts add column if not exists seen_at timestamptz;
