// Single source of truth for everything that changes when this app is forked
// for a new client/event. Fork the repo, edit this file (and .env), ship.
// Narrative copy inside app/page.tsx and the guestbook (the boarding-pass
// metaphor, raffle wording, arrival steps, etc.) is intentionally not routed
// through here — that's theme/party-type work for later, not config.

export const SITE_CONFIG = {
  siteName: "Baby Moncada",
  babyLabel: "Baby Moncada",

  hosts: {
    names: ["Janelle", "Fernando"] as const,
    displayName: "Janelle and Fernando",
    primaryContactName: "Janelle",
  },

  family: {
    label: "Moncada family",
    pluralLabel: "the Moncadas",
  },

  event: {
    title: "Baby Moncada Baby Shower",
    dateLabel: "September 26, 2026",
    dateShort: "09.26.26",
    startIso: "2026-09-26T23:00:00.000Z",
    timeZone: "America/Los_Angeles",
    boardingWindowMs: 60 * 60 * 1000,
    durationMs: 5 * 60 * 60 * 1000,
    fallbackRsvpDeadline: "2026-09-11",
    gateLabel: "The Reunion Room",
  },

  venue: {
    name: "Hotel Centro Sonoma Wine Country",
    brand: "Tapestry by Hilton",
    address: "5870 Labath Ave, Rohnert Park, CA 94928",
    bookingUrl: "https://www.hilton.com/en/hotels/stsrhup-hotel-centro-sonoma-wine-country/?SEO_id=GMB-AMER-UP-STSRHUP",
    appleMapsUrl: "https://maps.apple.com/?daddr=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&dirflg=d",
    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&destination=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&travelmode=driving&dir_action=navigate",
    wazeUrl: "https://waze.com/ul?q=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&navigate=yes",
    mapEmbedUrl: "https://www.openstreetmap.org/export/embed.html?bbox=-122.7305%2C38.3456%2C-122.7105%2C38.3577&layer=mapnik&marker=38.3516523%2C-122.7205662",
  },

  contact: {
    phone: "+17073345988",
    email: "j_elyssa05@yahoo.com",
  },

  registry: {
    url: "https://www.amazon.com/baby-reg/janelle-moncada-november-2026-rohnertpark/10AIJQD53FRAQ",
  },

  photoAlbum: {
    url: "https://photos.icloud.com/shared/album/0eccWFCNcNKvZ0UPIb95aAiwg",
    name: "Janelle & Fernando’s Baby Shower",
  },

  branding: {
    themeColor: "#dcecf4",
    backgroundColor: "#dcecf4",
    cookiePrefix: "baby_moncada",
  },

  guestbook: {
    airlineName: "Moncada Airways",
    flightCode: "Flt JF926",
    parentsPhotoAlt: "Janelle and Fernando holding up the ultrasound of their baby boy",
    parentsPhotoCaption: "Janelle, Fernando & baby boy",
  },
} as const;
