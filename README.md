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

Amazon is the checkout and fulfillment source of truth. A GitHub Actions browser job checks every still-needed and purchased registry page every six hours, validates the full result, preserves Amazon's registry-context item links, and atomically publishes the new snapshot through a narrowly scoped token-protected Supabase function. Guest requests only read the last complete verified snapshot, so an Amazon outage or incomplete scrape cannot replace it with partial data. The UI shows the verification time and keeps the exact official registry link above the products.

A read is checked against Amazon's own `<purchased>/<total> items purchased` header, which is the one independent number on the page and the only thing that catches a page Amazon silently skipped, because every page that was read still looks valid on its own. The header is treated as a completeness signal rather than an exact figure: on this registry it sits one unit above the sum of Amazon's own item cards, verified on captures from September 7 and 8 where every card parses and each card's `N NEEDED` badge matches its `N of M Purchased` text. A read short of the header by more than `REGISTRY_UNIT_TOLERANCE` is rejected; a missed page drops up to 30 items and is nowhere near that. Any smaller disagreement is logged on the run and published, because freezing the registry over Amazon's counter is worse for guests than a number none of them see.

A filter that comes back completely empty is treated as a failed read unless the header says the filter really is empty. An empty page part way through a filter is treated as the end of that filter even when Amazon still hands back a pagination key, which it does: reading that as a broken page left the registry stale for two days in September. A read that Amazon answered but that fails validation is not retried, since the answer will not change.

The parsing and pagination live in `scripts/amazon-registry-parser.mjs` so they can be tested without a browser. `tests/amazon-registry.test.mjs` runs them against real Amazon markup captured by the job's own diagnostics upload, including the exact page sequence that caused that outage.

The scheduled job is `.github/workflows/amazon-registry-sync.yml`. Its three GitHub Actions secrets are `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `REGISTRY_SYNC_TOKEN`. A failed run is logged in `registry_sync_runs`, leaves the prior snapshot untouched, uploads every page Amazon returned as a diagnostics artifact, and opens a `registry-sync` tracking issue that later failures comment on and the next success closes. Run the workflow manually with `dry_run` enabled to check Amazon without touching the live snapshot.

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

## Verification contract

`npm run verify` runs lint, integrity/security tests, and a production build. `npm run test:e2e` launches the real app and validates both desktop and iPhone-sized experiences, all six pilot rosters, exact external handoffs, and a real RSVP submit/reload/change cycle against Supabase. Automated test submissions must be deleted after verification so pilot households return to a clean state.
