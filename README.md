# Baby Moncada invitation

Production-oriented, mobile-first invitation and RSVP system for Janelle and Fernando Moncada’s baby shower on September 26, 2026 at 4:00 PM.

## Pilot scope

The pilot contains six deliberately varied households:

- `/invite/murao`
- `/invite/ponticelle`
- `/invite/cabrera`
- `/invite/sainz`
- `/invite/morales-diaz`
- `/invite/castro`

The remaining households are intentionally not seeded until the pilot has been reviewed and battle-tested.

## Architecture

- Next.js App Router deployed to Vercel
- dedicated Supabase Postgres project (`baby-moncada`)
- household-scoped readable links backed by permanent UUIDs
- alias preservation when a host renames an already-sent link
- atomic, per-guest RSVP submissions with optional notes
- passcode-protected host dashboard with rate-limited login attempts
- dashboard editing for event details, household labels, guest names, and short links
- copy-link and copy-ready-message controls for every household
- RLS on every public-schema table; no direct browser table access
- a day-of departure mode that moves the invitation through boarding, in flight, and arrived

Amazon is the checkout and fulfillment source of truth. A GitHub Actions browser job checks every still-needed and purchased registry page, validates the full result, preserves Amazon's registry-context item links, and atomically publishes the new snapshot through a narrowly scoped token-protected Supabase function. Guest requests only read the last complete verified snapshot, so an Amazon outage or incomplete scrape cannot replace it with partial data. The UI shows the verification time and keeps the exact official registry link above the products.

The job is `.github/workflows/amazon-registry-sync.yml`. It ran every six hours through the shower and is now manual only; start it from the Actions tab when a fresh copy is needed. Its three GitHub Actions secrets are `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `REGISTRY_SYNC_TOKEN`. A failed run is logged in `registry_sync_runs` and leaves the prior snapshot untouched.

## Local setup

Copy `.env.example` to `.env.local` and configure the values. Never commit `.env.local`.

```bash
npm install
npm run verify
npm run test:e2e
npm run dev
```

Generate a passcode hash with:

```bash
npm run passcode:hash
```

## Required Vercel environment variables

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-only; never prefix with `NEXT_PUBLIC_`)
- `HOST_PASSCODE_HASH`
- `HOST_SESSION_SECRET`
- `NEXT_PUBLIC_SITE_URL=https://moncada-baby-shower.vercel.app`

The invitation reads its own clock. Before the event day it stays the boarding pass it has always been. On the event day it becomes a live departure board: status, gate, a countdown to 4:00 PM, one-tap directions and a text to Janelle at the top, arrival steps in place of the countdown, and a diaper raffle last call. It flips to NOW BOARDING at 4:00 PM, IN FLIGHT an hour later, and ARRIVED at 9:00 PM, when the screen settles into a thank you with the registry still open. Phases come from `event_starts_at`, so moving the time in the dashboard moves the whole day.

## Thank you postcards

After the shower, every invitation link becomes that household's thank you postcard: a "Greetings from Baby Moncada" front that flips to a handwritten note, an Adrian John stamp, the household's address lines, and the gift it thanks them for. Below the card sit the shared photo album, the guestbook book, the guestbook itself, and a quiet registry link.

The dashboard's Thank Yous section holds a gift line and personal note per household, a general note for anyone without one, and the text message template. Copy message copies the text and marks that household sent. Postcards stay off until the host turns them on, so links keep showing the arrived boarding pass until then; `?postcard=preview` on any invitation link shows its postcard early. When live, the link preview switches to `public/thank-you-og.png`.

Notes and settings live as JSON files in the private `thank-yous` storage bucket, which creates itself, so no migration is needed. First drafts can ship in `lib/thank-you-drafts.ts`, keyed by slug; they prefill the dashboard and never reach a postcard until saved. To put the shower photo inside the front's block letters, add it to `public/` and set `SHOWER_PHOTO` in `lib/thank-you.ts`.

## Guestbook photos

The photo step offers a photo from the party, any photo of the guest, or a fresh camera shot, plus a skip link. Camera roll picks open a drag and pinch screen first, and that placement carries into every frame.

## Verification contract

`npm run verify` runs lint, integrity/security tests, and a production build. Every e2e spec pins a fixed clock from `tests/e2e/event-clock.ts`, so phase-dependent UI is asserted deliberately instead of drifting with the calendar. `npm run test:e2e` launches the real app and validates both desktop and iPhone-sized experiences, all six pilot rosters, exact external handoffs, and a real RSVP submit/reload/change cycle against Supabase. Automated test submissions must be deleted after verification so pilot households return to a clean state.
