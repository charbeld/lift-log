-- Lift Log schema. Paste into Supabase → SQL Editor → Run. Safe to re-run.

create table if not exists public.gt_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  deleted boolean not null default false,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp()
);
create index if not exists gt_sessions_user_sync on public.gt_sessions (user_id, server_updated_at);

create table if not exists public.gt_profile (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  program jsonb,
  settings jsonb,
  client_updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp()
);

-- server_updated_at is the pull cursor, so the server always sets it.
create or replace function public.gt_touch() returns trigger language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists gt_sessions_touch on public.gt_sessions;
create trigger gt_sessions_touch before insert or update on public.gt_sessions
  for each row execute function public.gt_touch();
drop trigger if exists gt_profile_touch on public.gt_profile;
create trigger gt_profile_touch before insert or update on public.gt_profile
  for each row execute function public.gt_touch();

-- Row level security: each signed-in user only sees their own rows.
alter table public.gt_sessions enable row level security;
alter table public.gt_profile enable row level security;

drop policy if exists "own sessions" on public.gt_sessions;
create policy "own sessions" on public.gt_sessions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own profile" on public.gt_profile;
create policy "own profile" on public.gt_profile for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
