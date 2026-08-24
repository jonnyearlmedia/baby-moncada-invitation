# Baby Moncada Invitation

A mobile-first digital invitation for Janelle and Fernando Moncada’s baby shower on September 26, 2026. The selected design direction is blue luxe stationery, inspired by the polished physical-card feeling of Paperless Post.

## Guest experience

- personalized invitation for the Murao family, party of two: Elsa and Jonathan
- live countdown to September 26
- named, per-person RSVP with durable Cloudflare D1 storage and editable confirmations
- Hotel Centro room-block summary with dates, verified room types, group code, average rate, and an official Hilton booking handoff
- current Babylist registry items, images, categories, quantities, fulfillment state, and exact item-level retailer offers
- an embedded destination map plus Apple Maps and Google Maps directions
- an all-day calendar file until the hosts confirm the event time

## Source-of-truth boundaries

The invitation does not pretend to complete transactions it cannot own:

- Babylist remains responsible for checkout, outside-retailer purchase marking, returns, and thank-you tracking. The app reads the public registry feed and opens each gift’s exact offer URL.
- Hilton remains responsible for current availability, guest details, payment, and reservation confirmation. The app uses the official group deep link for September 25–27 with group code 905.
- This app owns household invitations and RSVP responses in D1.

If the Babylist feed cannot be refreshed, the app shows an explicit unavailable state instead of stale gift cards. If an RSVP save fails, the guest remains on the form with a retryable error instead of seeing a false confirmation.

## Run and verify

Requires Node.js 22.13 or newer.

```bash
npm install
npm run db:generate
npm test
npm run dev
```

`npm test` performs a production build and verifies the event facts, item-level registry integration, durable RSVP contract, and map handoffs. `npm run lint` performs the static code audit.

## Data model

- `households`: one private invitation token hash and display name per invited household
- `guests`: the named people included in that household’s invitation
- `rsvp_responses`: the household’s current per-guest attendance choices, note, and timestamps

The current test link seeds the Murao sample invitation. Additional guest households require the final guest roster and unique invitation links before general distribution.

## Confirm before final guest launch

The hosts have not yet supplied an event start/end time or RSVP deadline. The interface says “Event time to be announced,” the countdown ends at the start of September 26, and the calendar download is intentionally all-day. Do not invent those values; update them after the hosts confirm them.
