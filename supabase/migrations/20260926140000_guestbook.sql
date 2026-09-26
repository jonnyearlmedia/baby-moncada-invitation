create table public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null check (char_length(guest_name) between 1 and 60),
  message text not null check (char_length(message) between 1 and 500),
  frame text not null default 'none' check (frame in ('none', 'boarding', 'polaroid', 'stamp')),
  photo_path text check (photo_path is null or photo_path ~ '^entries/[0-9a-f-]{36}\.jpg$'),
  hidden boolean not null default false,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index guestbook_entries_visible_idx on public.guestbook_entries(created_at desc) where not hidden;
create index guestbook_entries_ip_time_idx on public.guestbook_entries(ip_hash, created_at desc);

alter table public.guestbook_entries enable row level security;
revoke all on public.guestbook_entries from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guestbook', 'guestbook', true, 3145728, array['image/jpeg'])
on conflict (id) do nothing;
