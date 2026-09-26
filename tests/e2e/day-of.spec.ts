import { expect, test, type Page } from "@playwright/test";
import { BOARDING, DAY_OF, IN_FLIGHT, LANDED } from "./event-clock";

const event = {
  title: "Baby Moncada Baby Shower",
  hostsDisplay: "Janelle & Fernando",
  startsAt: "2026-09-26T23:00:00.000Z",
  rsvpDeadline: "2026-09-11",
  venueName: "Hotel Centro Sonoma Wine Country",
  venueAddress: "5870 Labath Ave, Rohnert Park, CA 94928",
  contactEmail: "j_elyssa05@yahoo.com",
  contactPhone: "+17073345988",
  registryUrl: "https://www.amazon.com/baby-reg/janelle-moncada-november-2026-rohnertpark/10AIJQD53FRAQ",
  hotelBookingUrl: "https://www.hilton.com/",
  hotelBookingDeadline: "2026-09-01",
  hotelGroupCode: "905",
  hotelRateLabel: "$149 special group rate",
};

async function openInvitation(page: Page, at: Date, { submitted = true, response = "yes" as "yes" | "no" | null } = {}) {
  await page.clock.setFixedTime(at);
  await page.route("**/api/rsvp?slug=*", (route) => route.fulfill({
    json: {
      canonicalSlug: "day-of", household: "Day Of Party", invitationLabel: "Day Of Party", messageGreeting: "friends",
      guests: [{ id: "guest-1", name: "Test Guest", response }, { id: "guest-2", name: "Second Guest", response }],
      note: "", submitted, updatedAt: submitted ? "2026-09-02T16:00:00.000Z" : null, event,
    },
  }));
  await page.route("**/api/registry", (route) => route.fulfill({ json: { mode: "handoff" } }));
  await page.goto("/invite/day-of");
  await expect(page.locator(".invite-screen")).toBeVisible();
}

test("the invitation turns into a live departure board on the day", async ({ page }) => {
  await openInvitation(page, DAY_OF);

  const nav = page.getByRole("navigation", { name: "Invitation features" });
  await expect(nav.getByRole("button")).toHaveText(["Today", "Travel", "Registry", "RSVP", "Hotel"]);

  const board = page.locator(".departure-board");
  await expect(board).toHaveAttribute("data-phase", "today");
  await expect(board.locator(".flap-text")).toHaveText("BOARDING SOON");
  await expect(board).toContainText("Hotel Centro, Rohnert Park");
  await expect(board).toContainText("Hotel lobby");
  await expect(board).toContainText("Doors open at 4:00 PM");
  await expect(board.locator(".board-clock div")).toHaveCount(3);
  await expect(page.locator(".departure-stamp")).toHaveText("TODAY");

  const actions = page.locator(".invite-screen > .day-of-actions");
  await expect(actions.getByRole("link")).toHaveText(["Apple Maps", "Google Maps", "Waze"]);
  await expect(actions.getByRole("link", { name: "Apple Maps" })).toHaveAttribute("href", /maps\.apple\.com.*5870/);
  await expect(actions.getByRole("link", { name: "Google Maps" })).toHaveAttribute("href", /google\.com\/maps\/dir.*5870/);
  await expect(actions.getByRole("link", { name: "Waze" })).toHaveAttribute("href", /waze\.com\/ul.*5870.*navigate=yes/);

  const contact = page.locator(".invite-screen > .day-of-contact");
  await expect(contact.getByRole("link", { name: "Text Janelle" })).toHaveAttribute("href", "sms:+17073345988");
  await expect(contact.getByRole("link", { name: "Call Janelle" })).toHaveAttribute("href", "tel:+17073345988");

  await expect(page.locator(".arrival-strip")).toContainText("Follow the Baby Moncada signs");
  await expect(page.locator(".diaper-raffle")).toContainText("Last call");
  await expect(page.locator(".day-of-status")).toContainText("Party of 2, boarding at 4:00 PM");
  await expect(page.getByText("RSVP as soon as possible")).toHaveCount(0);
  await expect(page.locator(".countdown-wrap")).toHaveCount(0);
});

test("the board follows the party from boarding through arrival", async ({ page }) => {
  await openInvitation(page, BOARDING);
  await expect(page.locator(".departure-board .flap-text")).toHaveText("NOW BOARDING");
  await expect(page.locator(".departure-stamp")).toHaveText("BOARDING");
  await expect(page.locator(".departure-board")).toContainText("The hotel lobby is the gate");
  await expect(page.locator(".board-clock")).toHaveCount(0);

  await openInvitation(page, IN_FLIGHT);
  await expect(page.locator(".departure-board .flap-text")).toHaveText("IN FLIGHT");
  await expect(page.locator(".day-of-status")).toContainText("We are already there");
});

test("after the party the invitation settles into a thank you", async ({ page }) => {
  await openInvitation(page, LANDED);
  await expect(page.locator(".departure-board .flap-text")).toHaveText("ARRIVED");
  await expect(page.locator(".departure-stamp")).toHaveText("ARRIVED");

  await expect(page.locator(".arrival-strip")).toHaveCount(0);
  await expect(page.locator(".diaper-raffle")).toHaveCount(0);
  await expect(page.locator(".invite-screen > .day-of-actions")).toHaveCount(0);
  await expect(page.locator(".invite-screen > .day-of-contact")).toHaveCount(0);

  const landed = page.locator(".landed-card");
  await expect(landed).toContainText("Thanks for flying with us");
  await expect(landed.getByRole("link", { name: "Open the registry on Amazon" })).toHaveAttribute("href", event.registryUrl);
  await expect(page.locator(".day-of-status")).toContainText("Baby Moncada is due November 25, 2026");
});

test("a household that never replied is invited in rather than nagged", async ({ page }) => {
  await openInvitation(page, DAY_OF, { submitted: false, response: null });
  const status = page.locator(".day-of-status");
  await expect(status).toContainText("Come anyway");
  await expect(status).toContainText("Send Janelle a text if you are on your way");
  await expect(page.getByText("RSVP as soon as possible")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "RSVP now" })).toBeVisible();
});

test("travel and hotel screens answer the day's questions first", async ({ page }) => {
  await openInvitation(page, BOARDING);
  const nav = page.getByRole("navigation", { name: "Invitation features" });

  await nav.getByRole("button", { name: "Travel", exact: true }).click();
  const banner = page.locator(".day-of-banner");
  await expect(banner).toContainText("Boarding now");
  await expect(banner).toContainText("5870 Labath Ave, Rohnert Park");
  await expect(banner.getByRole("link")).toHaveText(["Apple Maps", "Google Maps", "Waze"]);
  await expect(banner.getByRole("button", { name: "Copy address" })).toBeVisible();
  await expect(page.getByText("Hilton currently lists parking at $8 per day")).toBeVisible();

  await nav.getByRole("button", { name: "Hotel", exact: true }).click();
  const hotelBanner = page.locator(".day-of-banner");
  await expect(hotelBanner).toContainText("This is the venue");
  await expect(hotelBanner).toContainText("You do not need a room to be here");
  const overnight = page.locator(".overnight-note");
  await expect(overnight).toContainText("Only if you booked a room");
  await expect(overnight).toContainText("Checkout is Sunday, September 27");
  await expect(page.getByText("Still need a room tonight?")).toBeVisible();
  await expect(page.locator(".room")).toHaveCount(0);
  await expect(page.getByText("Check in")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Check rooms & book with Hilton" })).toBeVisible();

  const bannerBox = await hotelBanner.boundingBox();
  const overnightBox = await overnight.boundingBox();
  expect(bannerBox!.y).toBeLessThan(overnightBox!.y);
});
