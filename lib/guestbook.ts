export const GUESTBOOK_BUCKET = "guestbook";
export const GUESTBOOK_FRAMES = ["none", "boarding", "polaroid", "stamp"] as const;
export const GUESTBOOK_SIGN_OFFS = ["Love,", "With love,", "Sincerely,", "Hugs,"] as const;
export const GUESTBOOK_NAME_MAX = 60;
export const GUESTBOOK_MESSAGE_MAX = 500;
export const GUESTBOOK_PHOTO_MAX_BYTES = 3 * 1024 * 1024;

export type GuestbookFrame = (typeof GUESTBOOK_FRAMES)[number];
export type GuestbookSignOff = (typeof GUESTBOOK_SIGN_OFFS)[number];

export type GuestbookEntry = {
  id: string;
  name: string;
  message: string;
  signOff: GuestbookSignOff;
  frame: GuestbookFrame;
  photoUrl: string | null;
  createdAt: string;
  hidden?: boolean;
};
