/** Fixed instants (BEFORE_EVENT sits after the RSVP deadline and before the day itself) for the invitation's five phases, so UI assertions never depend on when the suite runs. */
export const BEFORE_EVENT = new Date("2026-09-20T18:00:00.000Z");
export const DAY_OF = new Date("2026-09-26T19:30:00.000Z");
export const BOARDING = new Date("2026-09-26T23:20:00.000Z");
export const IN_FLIGHT = new Date("2026-09-27T01:30:00.000Z");
export const LANDED = new Date("2026-09-27T05:00:00.000Z");
