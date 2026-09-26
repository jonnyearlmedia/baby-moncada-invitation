export const GUESTBOOK_BUCKET = "guestbook";
export const GUESTBOOK_FRAMES = ["none", "boarding", "polaroid", "stamp"] as const;
export const GUESTBOOK_NAME_MAX = 60;
export const GUESTBOOK_MESSAGE_MAX = 500;
export const GUESTBOOK_PHOTO_MAX_BYTES = 3 * 1024 * 1024;

export type GuestbookFrame = (typeof GUESTBOOK_FRAMES)[number];

export type GuestbookEntry = {
  id: string;
  name: string;
  message: string;
  frame: GuestbookFrame;
  photoUrl: string | null;
  createdAt: string;
  hidden?: boolean;
};

export type GuestbookRow = {
  id: string;
  guest_name: string;
  message: string;
  frame: GuestbookFrame;
  photo_path: string | null;
  hidden: boolean;
  created_at: string;
};

export const GUESTBOOK_COLUMNS = "id, guest_name, message, frame, photo_path, hidden, created_at";
