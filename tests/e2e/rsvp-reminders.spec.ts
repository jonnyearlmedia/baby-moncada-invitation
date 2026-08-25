import { expect, test } from "@playwright/test";

const event = {
  title: "Baby Moncada Baby Shower",
  hostsDisplay: "Janelle & Fernando",
  startsAt: "2026-09-26T23:00:00.000Z",
  rsvpDeadline: "2026-09-11",
  venueName: "Hotel Centro Sonoma Wine Country",
  venueAddress: "5870 Labath Ave, Rohnert Park, CA 94928",
  contactEmail: "j_elyssa05@yahoo.com",
  contactPhone: "+17073345988",
  registryUrl: "https://my.babylist.com/janelle-fernando",
  hotelBookingUrl: "https://www.hilton.com/",
  hotelBookingDeadline: "2026-09-01",
  hotelGroupCode: "905",
  hotelRateLabel: "$149 special group rate",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/rsvp?slug=*", async (route) => {
    const slug = new URL(route.request().url()).searchParams.get("slug") ?? "attending-reminder";
    const response = slug === "declined-reminder" ? "no" : "yes";
    await route.fulfill({
      json: {
        canonicalSlug: slug,
        household: "Reminder Test Party",
        invitationLabel: "Reminder Test Party",
        messageGreeting: "friends",
        guests: [{ id: "guest-1", name: "Test Guest", response }],
        note: "",
        submitted: true,
        updatedAt: "2026-08-25T16:00:00.000Z",
        event,
      },
    });
  });
});

test("attendees see both reminders directly below Change response", async ({ page }) => {
  await page.goto("/invite/attending-reminder");
  await page.getByRole("button", { name: "RSVP", exact: true }).first().click();

  const changeResponse = page.getByRole("button", { name: "Change response" });
  const reminders = page.getByLabel("Before the baby shower");
  await expect(changeResponse).toBeVisible();
  await expect(reminders).toContainText("Bring a pack of diapers");
  await expect(reminders).toContainText("Save this invitation");
  await expect(reminders).toContainText("Home Screen or bookmarks");
  await expect(reminders).toContainText("registry items, directions, hotel details, and event updates");

  await expect(changeResponse.locator("xpath=following-sibling::*[1]")).toHaveClass(/rsvp-next-steps/);
});

test("an all-declined RSVP does not show attendee reminders", async ({ page }) => {
  await page.goto("/invite/declined-reminder");
  await page.getByRole("button", { name: "RSVP", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Change response" })).toBeVisible();
  await expect(page.getByLabel("Before the baby shower")).toHaveCount(0);
});
