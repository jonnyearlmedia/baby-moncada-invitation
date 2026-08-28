create table public.registry_sync_credentials (
  id boolean primary key default true check (id),
  token_hash bytea not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);

alter table public.registry_sync_credentials enable row level security;
revoke all on public.registry_sync_credentials from public, anon, authenticated;

create or replace function public.commit_amazon_registry_sync(
  p_token text,
  p_items jsonb,
  p_source_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_count integer;
  v_fulfilled_count integer;
  v_old_count integer;
  v_retained_count integer;
  v_now timestamptz := clock_timestamp();
begin
  if length(p_token) < 64 or not exists (
    select 1
    from public.registry_sync_credentials credentials
    where credentials.id = true
      and credentials.token_hash = extensions.digest(p_token, 'sha256')
  ) then
    raise exception 'Invalid registry sync credential' using errcode = '28000';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Registry payload must be an array';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 500 then
    raise exception 'Registry payload has an invalid item count: %', v_item_count;
  end if;

  if p_source_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'Registry fingerprint is invalid';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where coalesce(item->>'id', '') = ''
      or coalesce(item->>'title', '') = ''
      or coalesce(item->>'image', '') not like 'https://m.media-amazon.com/%'
      or jsonb_typeof(item->'offers') <> 'array'
      or jsonb_array_length(item->'offers') <> 1
      or coalesce(item->'offers'->0->>'url', '') not like 'https://www.amazon.com/%/dp/%'
      or position('colid=10AIJQD53FRAQ' in (item->'offers'->0->>'url')) = 0
      or position('coliid=' in (item->'offers'->0->>'url')) = 0
  ) then
    raise exception 'Registry payload contains an invalid item or destination';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    group by item->>'id'
    having count(*) > 1
  ) then
    raise exception 'Registry payload contains duplicate item IDs';
  end if;

  select state.item_count into v_old_count
  from public.registry_sync_state state
  where state.id = true
  for update;

  if coalesce(v_old_count, 0) > 0 then
    select count(*) into v_retained_count
    from jsonb_array_elements((select items from public.registry_sync_state where id = true)) old_item
    where exists (
      select 1
      from jsonb_array_elements(p_items) new_item
      where new_item->>'id' = old_item->>'id'
    );
    if v_retained_count * 4 < v_old_count * 3 then
      raise exception 'Safety check blocked a large registry drop: %/% retained', v_retained_count, v_old_count;
    end if;
  end if;

  select count(*) into v_fulfilled_count
  from jsonb_array_elements(p_items) item
  where (item->>'isFulfilled')::boolean = true;

  update public.registry_sync_state
  set source = 'Amazon',
      registry_url = 'https://www.amazon.com/baby-reg/janelle-moncada-november-2026-rohnertpark/10AIJQD53FRAQ',
      items = p_items,
      item_count = v_item_count,
      fulfilled_count = v_fulfilled_count,
      last_started_at = v_now,
      last_succeeded_at = v_now,
      syncing_until = null,
      last_error = null,
      updated_at = v_now
  where id = true;

  insert into public.registry_sync_runs (
    status,
    item_count,
    offer_count,
    source_fingerprint,
    detail,
    started_at,
    finished_at
  ) values (
    'succeeded',
    v_item_count,
    v_item_count,
    p_source_fingerprint,
    format('GitHub browser sync: %s purchased', v_fulfilled_count),
    v_now,
    v_now
  );

  return jsonb_build_object(
    'itemCount', v_item_count,
    'fulfilledCount', v_fulfilled_count,
    'syncedAt', v_now
  );
end;
$$;

create or replace function public.record_amazon_registry_sync_failure(
  p_token text,
  p_detail text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_detail text := left(coalesce(p_detail, 'Unknown GitHub browser sync failure'), 500);
begin
  if length(p_token) < 64 or not exists (
    select 1
    from public.registry_sync_credentials credentials
    where credentials.id = true
      and credentials.token_hash = extensions.digest(p_token, 'sha256')
  ) then
    raise exception 'Invalid registry sync credential' using errcode = '28000';
  end if;

  update public.registry_sync_state
  set last_error = v_detail,
      syncing_until = null,
      updated_at = v_now
  where id = true;

  insert into public.registry_sync_runs (status, detail, started_at, finished_at)
  values ('failed', 'GitHub browser sync: ' || v_detail, v_now, v_now);
end;
$$;

revoke all on function public.commit_amazon_registry_sync(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.record_amazon_registry_sync_failure(text, text) from public, anon, authenticated;
grant execute on function public.commit_amazon_registry_sync(text, jsonb, text) to anon;
grant execute on function public.record_amazon_registry_sync_failure(text, text) to anon;
