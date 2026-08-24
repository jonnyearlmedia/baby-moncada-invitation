export type Attendance = "yes" | "no" | null;

export type EventSettings = {
  title: string;
  hostsDisplay: string;
  startsAt: string;
  rsvpDeadline: string;
  venueName: string;
  venueAddress: string;
  contactEmail: string;
  contactPhone: string;
  registryUrl: string;
  hotelBookingUrl: string;
  hotelBookingDeadline: string;
  hotelGroupCode: string;
  hotelRateLabel: string;
};

export type InvitationPayload = {
  canonicalSlug: string;
  household: string;
  invitationLabel: string;
  messageGreeting: string;
  guests: { id: string; name: string; response: Attendance }[];
  note: string;
  submitted: boolean;
  updatedAt: string | null;
  event: EventSettings;
};
