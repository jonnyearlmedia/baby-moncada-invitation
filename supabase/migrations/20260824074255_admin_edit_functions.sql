create or replace function public.admin_update_event(p_settings jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.event_settings set
    event_title = trim(p_settings->>'eventTitle'),
    hosts_display = trim(p_settings->>'hostsDisplay'),
    event_starts_at = (p_settings->>'eventStartsAt')::timestamptz,
    venue_name = trim(p_settings->>'venueName'),
    venue_address = trim(p_settings->>'venueAddress'),
    contact_email = trim(p_settings->>'contactEmail'),
    contact_phone = trim(p_settings->>'contactPhone'),
    registry_url = trim(p_settings->>'registryUrl'),
    hotel_booking_url = trim(p_settings->>'hotelBookingUrl'),
    hotel_booking_deadline = (p_settings->>'hotelBookingDeadline')::date,
    hotel_group_code = trim(p_settings->>'hotelGroupCode'),
    hotel_rate_label = trim(p_settings->>'hotelRateLabel'),
    copy_message_template = p_settings->>'copyMessageTemplate'
  where id;
  insert into public.admin_audit_log(action, entity_type, entity_id, detail)
  values('update', 'event_settings', 'singleton', p_settings);
end;
$$;

create or replace function public.admin_update_household(
  p_household_id uuid,
  p_slug text,
  p_display_name text,
  p_invitation_label text,
  p_message_greeting text,
  p_guests jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected integer;
  v_received integer;
begin
  select count(*) into v_expected from public.guests where household_id = p_household_id;
  select count(distinct (item->>'id')::uuid) into v_received
  from jsonb_array_elements(p_guests) item
  join public.guests g on g.id = (item->>'id')::uuid and g.household_id = p_household_id
  where char_length(trim(item->>'name')) between 1 and 100;
  if v_expected = 0 or v_received <> v_expected or jsonb_array_length(p_guests) <> v_expected then
    raise exception 'Every existing guest must have a valid name';
  end if;

  perform public.rename_household_slug(p_household_id, p_slug);
  update public.households set
    display_name = trim(p_display_name),
    invitation_label = trim(p_invitation_label),
    message_greeting = trim(p_message_greeting)
  where id = p_household_id;

  update public.guests g set display_name = trim(item->>'name')
  from jsonb_array_elements(p_guests) item
  where g.id = (item->>'id')::uuid and g.household_id = p_household_id;

  insert into public.admin_audit_log(action, entity_type, entity_id, detail)
  values('update', 'household', p_household_id::text, jsonb_build_object('slug', p_slug, 'displayName', p_display_name));
end;
$$;

revoke execute on function public.admin_update_event(jsonb) from public, anon, authenticated;
revoke execute on function public.admin_update_household(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_event(jsonb) to service_role;
grant execute on function public.admin_update_household(uuid, text, text, text, text, jsonb) to service_role;
