-- One-time data for the Moncada baby shower pilot. Not a migration: this is
-- client-specific data, not schema, so it does not live in supabase/migrations/.
-- Run it once, by hand, against a project that already has every migration
-- applied. A new client gets their own version of this file with their own
-- event, households, and guests — never this one.

insert into public.event_settings (
  event_title, hosts_display, event_starts_at, venue_name, venue_address,
  contact_email, contact_phone, registry_url, hotel_booking_url,
  hotel_booking_deadline, hotel_group_code, hotel_rate_label, copy_message_template
) values (
  'Baby Moncada', 'Janelle & Fernando', '2026-09-26 16:00:00-07',
  'Hotel Centro Sonoma Wine Country', '5870 Labath Ave, Rohnert Park, CA 94928',
  'j_elyssa05@yahoo.com', '+17073345988',
  'https://www.amazon.com/baby-reg/janelle-moncada-november-2026-rohnertpark/10AIJQD53FRAQ',
  'https://www.hilton.com/en/book/reservation/rooms/?ctyhocn=STSRHUP&arrivalDate=2026-09-25&departureDate=2026-09-27&groupCode=905&room1NumAdults=1&cid=OM%2CWW%2CHILTONLINK%2CEN%2CDirectLink',
  '2026-09-11', '905', '$149 avg/night',
  'Hi {{household}}! You are invited to celebrate Baby Moncada. View the invitation and RSVP for your party here: {{link}}'
);

insert into public.registry_sync_state (id, registry_url)
values (true, 'https://www.amazon.com/baby-reg/janelle-moncada-november-2026-rohnertpark/10AIJQD53FRAQ');

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
