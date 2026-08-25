create or replace function public.admin_create_household(
  p_slug_base text,
  p_display_name text,
  p_invitation_label text,
  p_message_greeting text,
  p_guests jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_slug_base text := lower(trim(p_slug_base));
  v_slug text;
  v_suffix integer := 1;
  v_guest_count integer;
begin
  if v_slug_base !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug_base) > 72 then
    raise exception 'Short link must use letters, numbers, and single hyphens';
  end if;
  if char_length(trim(p_display_name)) not between 1 and 300
    or char_length(trim(p_invitation_label)) not between 1 and 300
    or char_length(trim(p_message_greeting)) not between 1 and 150 then
    raise exception 'Invitation wording is invalid';
  end if;
  if jsonb_typeof(p_guests) <> 'array' then
    raise exception 'Guests must be an array';
  end if;

  select count(*) into v_guest_count
  from jsonb_array_elements_text(p_guests) guest_name
  where char_length(trim(guest_name)) between 1 and 100;
  if v_guest_count not between 1 and 20 or v_guest_count <> jsonb_array_length(p_guests) then
    raise exception 'Enter between 1 and 20 valid guest names';
  end if;

  -- Serialize only the short slug-allocation window so concurrent host requests
  -- cannot choose the same readable link. This singleton row is otherwise
  -- updated only by brief dashboard settings transactions.
  perform id from public.event_settings where id for update;
  loop
    v_slug := case when v_suffix = 1 then v_slug_base else v_slug_base || '-' || v_suffix::text end;
    exit when not exists (select 1 from public.households where slug = v_slug)
      and not exists (select 1 from public.household_slug_aliases where slug = v_slug);
    v_suffix := v_suffix + 1;
    if v_suffix > 9999 then
      raise exception 'No available short link could be generated';
    end if;
  end loop;

  insert into public.households (slug, display_name, invitation_label, message_greeting)
  values (v_slug, trim(p_display_name), trim(p_invitation_label), trim(p_message_greeting))
  returning id into v_household_id;

  insert into public.guests (household_id, display_name, sort_order)
  select v_household_id, trim(guest_name), ordinal::integer - 1
  from jsonb_array_elements_text(p_guests) with ordinality as guest(guest_name, ordinal);

  insert into public.admin_audit_log(action, entity_type, entity_id, detail)
  values(
    'create',
    'household',
    v_household_id::text,
    jsonb_build_object('slug', v_slug, 'displayName', trim(p_display_name), 'guestCount', v_guest_count)
  );

  return jsonb_build_object(
    'id', v_household_id,
    'slug', v_slug,
    'displayName', trim(p_display_name),
    'invitationLabel', trim(p_invitation_label),
    'messageGreeting', trim(p_message_greeting),
    'guests', p_guests
  );
end;
$$;

revoke execute on function public.admin_create_household(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_create_household(text, text, text, text, jsonb) to service_role;
