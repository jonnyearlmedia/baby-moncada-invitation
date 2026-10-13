// First drafts of each household's thank you, keyed by invitation slug. They
// prefill the dashboard until Janelle saves her own version, and show on a
// ?postcard=preview link, but never on a live postcard on their own. Only
// server code imports this file.
export const THANK_YOU_DRAFTS: Record<string, { gift: string; note: string }> = {
  murao: {
    gift: "The VistaView 1080p baby monitor",
    note: "Jonathan, thank you so much for the baby monitor! Being able to peek in on Adrian John from the other room, even at 3am, is going to give us so much peace of mind.\n\nMom, having you there meant everything. We love you both and can't wait for you to meet him.",
  },
};
