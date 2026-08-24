create table public.event_settings (
  id boolean primary key default true check (id),
  event_title text not null,
  hosts_display text not null,
  event_starts_at timestamptz not null,
  venue_name text not null,
  venue_address text not null,
  contact_email text not null,
  contact_phone text not null,
  registry_url text not null,
  hotel_booking_url text not null,
  hotel_booking_deadline date not null,
  hotel_group_code text not null,
  hotel_rate_label text not null,
  copy_message_template text not null,
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null,
  invitation_label text not null,
  message_greeting text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_slug_aliases (
  slug text primary key check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  household_id uuid not null references public.households(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  display_name text not null,
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, sort_order)
);

create table public.rsvp_submissions (
  household_id uuid primary key references public.households(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 180),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rsvp_guest_responses (
  guest_id uuid primary key references public.guests(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  response text not null check (response in ('yes', 'no')),
  updated_at timestamptz not null default now()
);

create index rsvp_guest_responses_household_idx on public.rsvp_guest_responses(household_id);

create table public.registry_items (
  source_item_id bigint primary key,
  title text not null,
  image_url text,
  babylist_item_url text not null,
  category text not null,
  quantity integer not null default 1 check (quantity > 0),
  quantity_needed integer not null default 1 check (quantity_needed >= 0),
  is_fulfilled boolean not null default false,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

create table public.registry_offers (
  source_offer_id bigint primary key,
  source_item_id bigint not null references public.registry_items(source_item_id) on delete cascade,
  store_name text not null,
  exact_url text not null,
  price numeric(10,2),
  availability text,
  is_babylist boolean not null default false,
  synced_at timestamptz not null default now()
);

create index registry_offers_item_idx on public.registry_offers(source_item_id);

create table public.registry_sync_runs (
  id bigint generated always as identity primary key,
  status text not null check (status in ('started', 'succeeded', 'failed', 'blocked')),
  item_count integer,
  offer_count integer,
  source_fingerprint text,
  detail text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.admin_login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);

create index admin_login_attempts_ip_time_idx on public.admin_login_attempts(ip_hash, attempted_at desc);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  action text not null,
  entity_type text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger event_settings_updated_at before update on public.event_settings
for each row execute function public.set_updated_at();
create trigger households_updated_at before update on public.households
for each row execute function public.set_updated_at();
create trigger guests_updated_at before update on public.guests
for each row execute function public.set_updated_at();
create trigger rsvp_submissions_updated_at before update on public.rsvp_submissions
for each row execute function public.set_updated_at();

create or replace function public.submit_household_rsvp(
  p_slug text,
  p_responses jsonb,
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_invited_count integer;
  v_received_count integer;
begin
  select h.id into v_household_id
  from public.households h
  left join public.household_slug_aliases a on a.household_id = h.id
  where h.enabled and (h.slug = lower(p_slug) or a.slug = lower(p_slug))
  limit 1;

  if v_household_id is null then
    raise exception 'Invitation not found';
  end if;

  if jsonb_typeof(p_responses) <> 'array' then
    raise exception 'Responses must be an array';
  end if;

  select count(*) into v_invited_count from public.guests where household_id = v_household_id;
  select count(distinct (item->>'guestId')::uuid) into v_received_count
  from jsonb_array_elements(p_responses) item
  join public.guests g on g.id = (item->>'guestId')::uuid and g.household_id = v_household_id
  where item->>'response' in ('yes', 'no');

  if v_received_count <> v_invited_count or jsonb_array_length(p_responses) <> v_invited_count then
    raise exception 'Please answer for every person named on this invitation';
  end if;

  insert into public.rsvp_submissions (household_id, note, submitted_at, updated_at)
  values (v_household_id, left(trim(coalesce(p_note, '')), 180), now(), now())
  on conflict (household_id) do update set note = excluded.note, updated_at = now();

  delete from public.rsvp_guest_responses where household_id = v_household_id;
  insert into public.rsvp_guest_responses (guest_id, household_id, response)
  select g.id, v_household_id, item->>'response'
  from jsonb_array_elements(p_responses) item
  join public.guests g on g.id = (item->>'guestId')::uuid and g.household_id = v_household_id;
end;
$$;

create or replace function public.rename_household_slug(p_household_id uuid, p_new_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_slug text;
  v_slug text := lower(trim(p_new_slug));
begin
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Invalid invitation link';
  end if;
  select slug into v_old_slug from public.households where id = p_household_id for update;
  if v_old_slug is null then raise exception 'Household not found'; end if;
  if v_old_slug = v_slug then return; end if;
  if exists(select 1 from public.households where slug = v_slug) or exists(select 1 from public.household_slug_aliases where slug = v_slug) then
    raise exception 'Invitation link is already in use';
  end if;
  update public.households set slug = v_slug where id = p_household_id;
  insert into public.household_slug_aliases(slug, household_id) values(v_old_slug, p_household_id)
  on conflict (slug) do nothing;
end;
$$;

alter table public.event_settings enable row level security;
alter table public.households enable row level security;
alter table public.household_slug_aliases enable row level security;
alter table public.guests enable row level security;
alter table public.rsvp_submissions enable row level security;
alter table public.rsvp_guest_responses enable row level security;
alter table public.registry_items enable row level security;
alter table public.registry_offers enable row level security;
alter table public.registry_sync_runs enable row level security;
alter table public.admin_login_attempts enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.submit_household_rsvp(text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.rename_household_slug(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_household_rsvp(text, jsonb, text) to service_role;
grant execute on function public.rename_household_slug(uuid, text) to service_role;

insert into public.event_settings (
  event_title, hosts_display, event_starts_at, venue_name, venue_address,
  contact_email, contact_phone, registry_url, hotel_booking_url,
  hotel_booking_deadline, hotel_group_code, hotel_rate_label, copy_message_template
) values (
  'Baby Moncada', 'Janelle & Fernando', '2026-09-26 16:00:00-07',
  'Hotel Centro Sonoma Wine Country', '5870 Labath Ave, Rohnert Park, CA 94928',
  'j_elyssa05@yahoo.com', '+17073345988',
  'https://my.babylist.com/janelle-fernando',
  'https://www.hilton.com/en/book/reservation/rooms/?ctyhocn=STSRHUP&arrivalDate=2026-09-25&departureDate=2026-09-27&groupCode=905&room1NumAdults=1&cid=OM%2CWW%2CHILTONLINK%2CEN%2CDirectLink',
  '2026-09-11', '905', '$149 avg/night',
  'Hi {{household}}! You are invited to celebrate Baby Moncada. View the invitation and RSVP for your party here: {{link}}'
);

insert into public.households (id, slug, display_name, invitation_label, message_greeting) values
  ('10000000-0000-4000-8000-000000000001', 'murao', 'Mom & Jonathan Murao', 'Mom & Jonathan Murao', 'Mom and Jonathan'),
  ('10000000-0000-4000-8000-000000000004', 'ponticelle', 'Auntie Grace Ponticelle', 'Auntie Grace Ponticelle', 'Auntie Grace'),
  ('10000000-0000-4000-8000-000000000006', 'cabrera', 'Kuya Maikhi Cabrera, Ate Michelle Cabrera, Trish, & Tique', 'Kuya Maikhi Cabrera, Ate Michelle Cabrera, Trish, & Tique', 'Cabrera household'),
  ('10000000-0000-4000-8000-000000000019', 'sainz', 'Danny Sainz, Jenna Sainz, Angelina, Lily, Ava, DJ, & Ray', 'Danny Sainz, Jenna Sainz, Angelina, Lily, Ava, DJ, & Ray', 'Sainz household'),
  ('10000000-0000-4000-8000-000000000025', 'morales-diaz', 'Facundo Morales, Kelly Diaz, & Eleni', 'Facundo Morales, Kelly Diaz, & Eleni', 'Facundo, Kelly, and Eleni'),
  ('10000000-0000-4000-8000-000000000057', 'castro', 'Jose Castro & Thalía Castro', 'Jose Castro & Thalía Castro', 'Jose and Thalía');

insert into public.guests (id, household_id, display_name, sort_order) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Mom', 0),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Jonathan Murao', 1),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', 'Auntie Grace Ponticelle', 0),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000006', 'Kuya Maikhi Cabrera', 0),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006', 'Ate Michelle Cabrera', 1),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 'Trish', 2),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000006', 'Tique', 3),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000019', 'Danny Sainz', 0),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000019', 'Jenna Sainz', 1),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000019', 'Angelina', 2),
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000019', 'Lily', 3),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000019', 'Ava', 4),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000019', 'DJ', 5),
  ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000019', 'Ray', 6),
  ('20000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000025', 'Facundo Morales', 0),
  ('20000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000025', 'Kelly Diaz', 1),
  ('20000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000025', 'Eleni', 2),
  ('20000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000057', 'Jose Castro', 0),
  ('20000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000057', 'Thalía Castro', 1);
