import { expect, test } from "@playwright/test";

const browserErrors = new WeakMap<import("@playwright/test").Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([]);
});

const pilots = [
  ["murao", "Mom & Jonathan Murao", ["Mom", "Jonathan Murao"]],
  ["ponticelle", "Auntie Grace Ponticelle", ["Auntie Grace Ponticelle"]],
  ["cabrera", "Kuya Maikhi Cabrera, Ate Michelle Cabrera, Trish, & Tique", ["Kuya Maikhi Cabrera", "Ate Michelle Cabrera", "Trish", "Tique"]],
  ["sainz", "Danny Sainz, Jenna Sainz, Angelina, Lily, Ava, DJ, & Ray", ["Danny Sainz", "Jenna Sainz", "Angelina", "Lily", "Ava", "DJ", "Ray"]],
  ["morales-diaz", "Facundo Morales, Kelly Diaz, & Eleni", ["Facundo Morales", "Kelly Diaz", "Eleni"]],
  ["castro", "Jose Castro & Thalía Castro", ["Jose Castro", "Thalía Castro"]],
] as const;

async function openRsvpForm(page: import("@playwright/test").Page, guestCount: number) {
  await page.getByRole("button", { name: "RSVP", exact: true }).first().click();
  const change = page.getByRole("button", { name: "Change response" });
  const invited = page.getByText(`${guestCount} invited`, { exact: true });
  await Promise.any([
    change.waitFor({ state: "visible", timeout: 5_000 }),
    invited.waitFor({ state: "visible", timeout: 5_000 }),
  ]);
  if (await change.isVisible()) await change.click();
  await expect(invited).toBeVisible();
}

for (const [slug, label, guests] of pilots) {
  test(`${slug} renders the correct household and RSVP roster`, async ({ page }) => {
    await page.goto(`/invite/${slug}`);
    await expect(page.getByText(`For ${label}`, { exact: true })).toBeVisible();
    await openRsvpForm(page, guests.length);
    for (const guest of guests) await expect(page.getByText(guest, { exact: true }).first()).toBeVisible();
  });
}

test("a real RSVP survives reload and can be changed", async ({ page }) => {
  await page.goto("/invite/ponticelle");
  await openRsvpForm(page, 1);
  await page.getByRole("button", { name: "Attending" }).click();
  await page.getByLabel(/Note for/).fill("Automated live RSVP verification");
  await page.getByRole("button", { name: /Confirm RSVP|Save changes/ }).click();
  await expect(page.getByText("Auntie Grace Ponticelle is attending.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "RSVP", exact: true }).first().click();
  await expect(page.getByText("Auntie Grace Ponticelle is attending.", { exact: true })).toBeVisible();
  await expect(page.getByText("“Automated live RSVP verification”", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Change response" }).click();
  await expect(page.getByLabel(/Note for/)).toHaveValue("Automated live RSVP verification");
  await page.getByRole("button", { name: "Can’t make it" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Auntie Grace Ponticelle can’t make it.", { exact: true })).toBeVisible();
});

test("hotel, maps, and registry handoffs use their exact destinations", async ({ page }) => {
  await page.goto("/invite/murao");
  await page.getByRole("button", { name: "Hotel" }).click();
  await expect(page.getByRole("link", { name: /Check rooms/ })).toHaveAttribute("href", /hilton\.com.*arrivalDate=2026-09-25.*groupCode=905/);
  await page.getByRole("button", { name: "Travel" }).click();
  await expect(page.getByRole("link", { name: "Open in Apple Maps" })).toHaveAttribute("href", /maps\.apple\.com.*5870/);
  await expect(page.getByRole("link", { name: "Open in Google Maps" })).toHaveAttribute("href", /google\.com\/maps\/dir.*5870/);
  await page.getByRole("button", { name: "Gifts" }).click();
  await expect(page.getByRole("link", { name: "Open the registry on Babylist" })).toHaveAttribute("href", /^https:\/\/my\.babylist\.com\/janelle-fernando/);
});
