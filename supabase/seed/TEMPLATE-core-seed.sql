-- Copy this file, fill in the placeholders, and run it once against a new
-- client's Supabase project after every migration in supabase/migrations/
-- has been applied. See README.md in this folder for the full setup order.

insert into public.event_settings (
  event_title, hosts_display, event_starts_at, venue_name, venue_address,
  contact_email, contact_phone, registry_url, hotel_booking_url,
  hotel_booking_deadline, hotel_group_code, hotel_rate_label, copy_message_template
) values (
  '<<EVENT_TITLE>>', '<<HOST_NAMES_DISPLAY>>', '<<EVENT_STARTS_AT e.g. 2027-05-01 16:00:00-07>>',
  '<<VENUE_NAME>>', '<<VENUE_ADDRESS>>',
  '<<CONTACT_EMAIL>>', '<<CONTACT_PHONE e.g. +15551234567>>',
  '<<REGISTRY_URL>>',
  '<<HOTEL_BOOKING_URL, or leave as empty string '' if there is no hotel block>>',
  '<<HOTEL_BOOKING_DEADLINE e.g. 2027-04-01>>', '<<HOTEL_GROUP_CODE>>', '<<HOTEL_RATE_LABEL e.g. $149 avg/night>>',
  'Hi {{household}}! You are invited to celebrate <<EVENT_TITLE>>. View the invitation and RSVP for your party here: {{link}}'
);

-- registry_url here must exactly match the one above — the sync function
-- reads the registry id out of this row, not out of event_settings.
insert into public.registry_sync_state (id, registry_url)
values (true, '<<REGISTRY_URL>>');

-- One row per household. id is any fresh random UUID (gen_random_uuid() is
-- fine run once by hand); slug is what shows up in the invitation link
-- (/invite/<slug>) and must be lowercase-with-dashes only.
insert into public.households (id, slug, display_name, invitation_label, message_greeting) values
  (gen_random_uuid(), '<<slug-one>>', '<<Display Name One>>', '<<Invitation Label One>>', '<<Greeting One>>');
-- , (gen_random_uuid(), '<<slug-two>>', '<<Display Name Two>>', '<<Invitation Label Two>>', '<<Greeting Two>>')
-- add as many more rows as there are households, comma-separated, ending the
-- statement with a semicolon on the last one.

-- One row per guest, linked to the household it belongs to by household_id.
-- Since the households above were inserted with gen_random_uuid() rather
-- than a fixed id, look their ids up first:
--   select id, slug from public.households;
-- then use the real id values below instead of a second gen_random_uuid()
-- call (a guest's household_id must match its household's actual id).
insert into public.guests (id, household_id, display_name, sort_order) values
  (gen_random_uuid(), '<<household id from the lookup above>>', '<<Guest Name>>', 0);
-- add one row per guest in a household, numbering sort_order 0, 1, 2... in
-- the order they should appear on that household's invitation.
