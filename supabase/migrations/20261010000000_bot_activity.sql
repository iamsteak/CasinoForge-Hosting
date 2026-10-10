create table if not exists public.bot_activity (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('deploy', 'restart', 'stop', 'rollback', 'variable_upsert', 'variable_delete')),
  outcome text not null check (outcome in ('requested', 'succeeded', 'failed')),
  summary text not null default '',
  deployment_id text,
  created_at timestamptz not null default now()
);

create index if not exists bot_activity_created_at_idx
  on public.bot_activity (created_at desc);

alter table public.bot_activity enable row level security;
revoke all on table public.bot_activity from anon, authenticated;
grant all on table public.bot_activity to service_role;
