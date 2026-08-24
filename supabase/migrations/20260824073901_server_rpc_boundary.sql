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

revoke execute on function public.get_invitation(text) from public, authenticated;
revoke execute on function public.get_public_event_settings() from public, authenticated;
grant execute on function public.get_invitation(text) to anon, service_role;
grant execute on function public.get_public_event_settings() to anon, service_role;
grant execute on function public.submit_household_rsvp(text, jsonb, text) to anon;
