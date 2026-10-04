create table public.registry_sync_state (
  id boolean primary key default true check (id),
  source text not null default 'Amazon',
  registry_url text not null,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  item_count integer not null default 0 check (item_count >= 0),
  fulfilled_count integer not null default 0 check (fulfilled_count >= 0),
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  syncing_until timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.registry_sync_state enable row level security;
revoke all on public.registry_sync_state from public, anon, authenticated;

-- No seed data here on purpose; see supabase/seed/.
