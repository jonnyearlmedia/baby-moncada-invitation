import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

const secret = "local-release-gate-secret-1234567890";

function sessionCookie() {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function dashboardFixture() {
  let guestNumber = 0;
  const households = Array.from({ length: 58 }, (_, householdIndex) => {
    const guestCount = householdIndex < 12 ? 3 : 2;
    const guests = Array.from({ length: guestCount }, (_, guestIndex) => {
      guestNumber += 1;
      return {
        id: `guest-${guestNumber}`,
        display_name: householdIndex === 0 && guestIndex === 0 ? "Auntie Grace Ponticelle" : `Guest ${guestNumber}`,
        response: householdIndex === 0 && guestIndex === 0 ? "yes" : householdIndex === 1 && guestIndex === 0 ? "no" : null,
        response_updated_at: householdIndex < 2 && guestIndex === 0 ? "2026-08-24T20:00:00.000Z" : null,
      };
    });
    return {
      id: `household-${householdIndex + 1}`,
      slug: householdIndex === 0 ? "ponticelle" : `party-${householdIndex + 1}`,
      display_name: householdIndex === 0 ? "Auntie Grace Ponticelle" : `Invitation Party ${householdIndex + 1}`,
      invitation_label: householdIndex === 0 ? "Auntie Grace Ponticelle" : `Invitation Party ${householdIndex + 1}`,
      message_greeting: householdIndex === 0 ? "Auntie Grace" : `Party ${householdIndex + 1}`,
      guests,
      submission: householdIndex === 0 ? { note: "Excited to celebrate!", updated_at: "2026-08-24T20:00:00.000Z" } : null,
    };
  });
  return {
    event: {
      event_title: "Baby Moncada Shower", hosts_display: "Janelle & Fernando", event_starts_at: "2026-10-10T23:00:00.000Z",
      venue_name: "Venue", venue_address: "5870 Address", contact_email: "j_elyssa05@yahoo.com", contact_phone: "+17073345988",
      registry_url: "https://my.babylist.com/janelle-fernando", hotel_booking_url: "https://www.hilton.com/", hotel_booking_deadline: "2026-09-01",
      hotel_group_code: "MON", hotel_rate_label: "Special rate", copy_message_template: "Hi {{household}}! {{link}}",
    },
    households,
    registrySync: null,
  };
}

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([{ name: "baby_moncada_host", value: sessionCookie(), url: "http://127.0.0.1:3000" }]);
  await page.route("**/api/admin/dashboard", async (route) => {
    if (route.request().method() === "GET") await route.fulfill({ json: dashboardFixture() });
    else await route.fulfill({ json: { ok: true } });
  });
});

test("dashboard defaults to invitation parties and preserves the individual guest view", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Responses by invitation party" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Parties", exact: true })).toHaveClass(/selected/);
  await expect(page.locator(".party-directory-card")).toHaveCount(58);
  await expect(page.locator(".party-guest-row")).toHaveCount(128);
  await expect(page.locator(".party-directory-card").first()).toContainText("/invite/ponticelle");
  await expect(page.locator(".party-directory-card").first()).toContainText("Auntie Grace Ponticelle");
  await expect(page.locator(".party-directory-card").first()).toContainText("Excited to celebrate!");

  await page.getByRole("button", { name: "Individual guests" }).click();
  await expect(page.getByRole("heading", { name: "Every guest, at a glance" })).toBeVisible();
  await expect(page.locator(".directory-row")).toHaveCount(128);

  await page.getByRole("button", { name: "Parties", exact: true }).click();
  await page.getByRole("textbox", { name: "Search guests, parties, or short links" }).fill("Grace Ponticelle");
  await expect(page.locator(".party-directory-card")).toHaveCount(1);
  await expect(page.locator(".party-directory-card")).toContainText("Auntie Grace Ponticelle");

  await page.getByRole("textbox", { name: "Search guests, parties, or short links" }).fill("");
  await page.getByRole("button", { name: "Yes", exact: true }).last().click();
  await expect(page.locator(".party-directory-card")).toHaveCount(1);
  await expect(page.locator(".party-directory-card")).toContainText("1 yes");
});
