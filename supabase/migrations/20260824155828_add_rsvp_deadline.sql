alter table public.event_settings
add column rsvp_deadline date not null default date '2026-09-11';

create or replace function public.get_invitation(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with resolved as (
    select h.*
    from public.households h
    left join public.household_slug_aliases a on a.household_id = h.id
    where h.enabled and (h.slug = lower(trim(p_slug)) or a.slug = lower(trim(p_slug)))
    order by (h.slug = lower(trim(p_slug))) desc
    limit 1
  ), guest_rows as (
    select g.id, g.display_name, g.sort_order, r.response
    from public.guests g
    join resolved h on h.id = g.household_id
    left join public.rsvp_guest_responses r on r.guest_id = g.id
    order by g.sort_order, g.id
  )
  select case when not exists(select 1 from resolved) then null else jsonb_build_object(
    'canonicalSlug', (select slug from resolved),
    'household', (select display_name from resolved),
    'invitationLabel', (select invitation_label from resolved),
    'messageGreeting', (select message_greeting from resolved),
    'guests', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id,
      'name', display_name,
      'response', response
    ) order by sort_order) from guest_rows), '[]'::jsonb),
    'note', coalesce((select note from public.rsvp_submissions s where s.household_id = (select id from resolved)), ''),
    'submitted', exists(select 1 from public.rsvp_submissions s where s.household_id = (select id from resolved)),
    'updatedAt', (select updated_at from public.rsvp_submissions s where s.household_id = (select id from resolved)),
    'event', (select jsonb_build_object(
      'title', e.event_title,
      'hostsDisplay', e.hosts_display,
      'startsAt', e.event_starts_at,
      'rsvpDeadline', e.rsvp_deadline,
      'venueName', e.venue_name,
      'venueAddress', e.venue_address,
      'contactEmail', e.contact_email,
      'contactPhone', e.contact_phone,
      'registryUrl', e.registry_url,
      'hotelBookingUrl', e.hotel_booking_url,
      'hotelBookingDeadline', e.hotel_booking_deadline,
      'hotelGroupCode', e.hotel_group_code,
      'hotelRateLabel', e.hotel_rate_label
    ) from public.event_settings e where e.id)
  ) end;
$$;

create or replace function public.get_public_event_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', e.event_title,
    'hostsDisplay', e.hosts_display,
    'startsAt', e.event_starts_at,
    'rsvpDeadline', e.rsvp_deadline,
    'venueName', e.venue_name,
    'venueAddress', e.venue_address,
    'contactEmail', e.contact_email,
    'contactPhone', e.contact_phone,
    'registryUrl', e.registry_url,
    'hotelBookingUrl', e.hotel_booking_url,
    'hotelBookingDeadline', e.hotel_booking_deadline,
    'hotelGroupCode', e.hotel_group_code,
    'hotelRateLabel', e.hotel_rate_label
  ) from public.event_settings e where e.id;
$$;

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
    rsvp_deadline = (p_settings->>'rsvpDeadline')::date,
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
