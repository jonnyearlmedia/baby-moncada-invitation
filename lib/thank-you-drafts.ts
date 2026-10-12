// First drafts of each household's thank you, keyed by invitation slug. They
// show in the dashboard until Janelle saves her own version, and never reach a
// guest's postcard on their own. Only server code imports this file.
export const THANK_YOU_DRAFTS: Record<string, { gift: string; note: string }> = {};
