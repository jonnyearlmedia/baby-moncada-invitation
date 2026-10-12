export const THANK_YOU_BUCKET = "thank-yous";
export const THANK_YOU_NOTE_MAX = 900;
export const THANK_YOU_GIFT_MAX = 120;
export const BABY_NAME = "Adrian John";

// Drop the shower photo in /public and point this at it. Without one, the
// postcard front paints its letters with a sunset instead.
export const SHOWER_PHOTO: { src: string; width: number; height: number } | null = null;

export type ThankYouSettings = {
  live: boolean;
  defaultNote: string;
  messageTemplate: string;
  updatedAt: string | null;
};

export type ThankYouNote = {
  householdId: string;
  gift: string;
  note: string;
  sentAt: string | null;
  updatedAt: string;
};

export type ThankYouPostcard = {
  slug: string;
  greeting: string;
  addressee: string;
  gift: string;
  note: string;
};

export const DEFAULT_THANK_YOU_SETTINGS: ThankYouSettings = {
  live: false,
  defaultNote: `Thank you so much for celebrating ${BABY_NAME} with us. We felt so much love at the shower, from everyone in the room and everyone cheering us on from afar. We can't wait for you to meet him.`,
  messageTemplate: `Hi {{household}}! Thank you so much for celebrating ${BABY_NAME} with us. We made you a little postcard: {{link}}`,
  updatedAt: null,
};

export function fillMessage(template: string, household: string, link: string) {
  return template.replaceAll("{{household}}", household).replaceAll("{{link}}", link);
}
