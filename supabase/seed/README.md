# Seed data

Files in `supabase/migrations/` are schema only — tables, functions, RLS.
They contain nothing specific to any one client, so they're safe to run
against a brand new, empty Supabase project.

Files in this folder are the opposite: one-time data for one specific
client. They are not migrations and nothing runs them automatically.

- `moncada-pilot-core-seed.sql` and `moncada-pilot-remaining-households.sql`
  are the Moncada baby shower's actual data (the event, the registry, every
  household and guest). They exist here as a record of what that project
  ran, not as something to reuse.

## Starting a new client

1. Create a new Supabase project.
2. Run every file in `supabase/migrations/`, in order, against it (the
   Supabase SQL editor, or `supabase db push` if you're using the CLI).
3. Copy `TEMPLATE-core-seed.sql`, fill in that client's event, registry, and
   first few households, and run it against their project.
4. Add more `insert into public.households (...)` / `insert into
   public.guests (...)` statements (copy the pattern in the template) for
   the rest of their guest list. There's no required mechanism for this —
   plain inserts are fine unless the guest list is large enough that the
   `do $seed$ ... end $seed$;` loop in `moncada-pilot-remaining-households.sql`
   is worth copying for convenience.
5. Fill in `lib/site-config.ts` in the app itself with the same facts (see
   that file's own comment) and point the app's env vars at the new
   Supabase project and a new Vercel project.

Nothing in this folder, or in `lib/site-config.ts`, should ever reference
more than one client's data at a time.
