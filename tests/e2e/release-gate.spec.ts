import { expect, test } from "@playwright/test";

const address = "5870 Labath Ave, Rohnert Park, CA 94928";

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
});

test("every guest-facing control works and every destination is exact", async ({ page }) => {
  await page.goto("/invite/murao");
  const nav = page.getByRole("navigation", { name: "Invitation features" });
  await expect(nav.getByRole("button")).toHaveText(["Invite", "Hotel", "Registry", "Travel", "RSVP"]);

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add to calendar" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("baby-moncada.ics");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const calendar = Buffer.concat(chunks).toString("utf8");
  expect(calendar).toContain("DTSTART;TZID=America/Los_Angeles:20260926T160000");
  expect(calendar).toContain(`LOCATION:${address}`);

  await page.getByRole("button", { name: "Share invite" }).click();
  await expect(page.getByRole("button", { name: "Link copied ✓" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("/invite/murao");

  await nav.getByRole("button", { name: "Hotel", exact: true }).click();
  await expect(page.getByRole("link", { name: "Check rooms & book with Hilton" })).toHaveAttribute("href", /ctyhocn=STSRHUP.*arrivalDate=2026-09-25.*departureDate=2026-09-27.*groupCode=905/);

  await nav.getByRole("button", { name: "Registry", exact: true }).click();
  const amazonHandoff = page.getByRole("link", { name: "See the full registry on Amazon" });
  await expect(amazonHandoff).toHaveAttribute("href", "https://www.amazon.com/baby-reg/janelle-moncada-november-2026-rohnertpark/10AIJQD53FRAQ");
  await expect(page.locator(".product").first()).toBeVisible();
  const handoffBox = await amazonHandoff.boundingBox();
  const firstProductBox = await page.locator(".product").first().boundingBox();
  expect(handoffBox).not.toBeNull();
  expect(firstProductBox).not.toBeNull();
  expect(handoffBox!.y).toBeLessThan(firstProductBox!.y);
  const firstProductTitle = await page.locator(".product h3").first().textContent();
  expect(firstProductTitle?.trim().length).toBeGreaterThan(0);
  await page.locator(".product").first().getByRole("button", { name: /View .* option/ }).click();
  await expect(page.locator(".offer-list a").first()).toHaveAttribute("href", /^https:\/\/www\.amazon\.com\/.*\/dp\/[A-Z0-9]{10}\?.*colid=10AIJQD53FRAQ.*coliid=[A-Z0-9]+/);
  await page.getByRole("button", { name: "Keep browsing gifts" }).click();

  await nav.getByRole("button", { name: "Travel", exact: true }).click();
  await expect(page.getByTitle(/Interactive map showing Hotel Centro/)).toHaveAttribute("src", /openstreetmap\.org.*marker=38\.3516523%2C-122\.7205662/);
  await expect(page.getByRole("link", { name: "Apple Maps" })).toHaveAttribute("href", /^https:\/\/maps\.apple\.com\/\?daddr=5870/);
  await expect(page.getByRole("link", { name: "Google Maps" })).toHaveAttribute("href", /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=5870/);
  await expect(page.getByRole("link", { name: "Waze" })).toHaveAttribute("href", /^https:\/\/waze\.com\/ul\?q=5870/);
  await page.getByRole("button", { name: "Copy address" }).click();
  await expect(page.getByRole("button", { name: "Copied ✓" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);

  await nav.getByRole("button", { name: "RSVP", exact: true }).click();
  const changeResponse = page.getByRole("button", { name: "Change response" });
  const confirm = page.getByRole("button", { name: /Confirm RSVP|Save changes/ });
  await expect(changeResponse.or(confirm)).toBeVisible();
  if (await changeResponse.isVisible()) await changeResponse.click();
  await expect(confirm).toBeVisible();
  const guestCards = page.locator(".invitee");
  await expect(guestCards).toHaveCount(2);
  for (const card of await guestCards.all()) await card.getByRole("button", { name: "Attending" }).click();
  await expect(confirm).toBeEnabled();
  await guestCards.nth(1).getByRole("button", { name: "Can’t make it" }).click();
  await expect(guestCards.nth(1).getByRole("button", { name: "Can’t make it" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel(/Note for Janelle & Fernando/).fill("Release gate note");
  await expect(page.getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:j_elyssa05@yahoo.com");
  await expect(page.getByRole("link", { name: "Text" })).toHaveAttribute("href", "sms:+17073345988");
  await expect(page.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+17073345988");
});

test("all external destinations resolve to the intended service and address", async ({ request }) => {
  const destinations = [
    ["https://maps.apple.com/?daddr=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&dirflg=d", /maps\.apple\.com\/directions.*5870/],
    ["https://www.google.com/maps/dir/?api=1&destination=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&travelmode=driving&dir_action=navigate", /google\.com\/maps\/dir.*5870/],
    ["https://waze.com/ul?q=5870%20Labath%20Ave%2C%20Rohnert%20Park%2C%20CA%2094928&navigate=yes", /waze\.com\/ul.*5870/],
  ] as const;
  for (const [url, finalPattern] of destinations) {
    const response = await request.get(url, { timeout: 20_000 });
    expect(response.status()).toBeLessThan(400);
    expect(response.url()).toMatch(finalPattern);
  }
});

test("dashboard controls work on the complete roster", async ({ context, page }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "Dashboard release gate uses the deployed environment secrets.");
  await page.goto("/dashboard");
  await page.locator("input").first().fill("1991");
  await page.getByRole("button", { name: "Open dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Type the names. The link builds itself." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Send links and track RSVPs" })).toBeVisible();
  const invitedCount = Number((await page.locator(".stats-grid").getByRole("button", { name: /All invited/ }).locator("strong").textContent())?.trim());
  const partyCount = Number((await page.getByText(/matching parties$/).textContent())?.match(/\d+/)?.[0]);
  expect(invitedCount).toBeGreaterThanOrEqual(128);
  expect(partyCount).toBeGreaterThanOrEqual(58);
  await expect(page.locator("details.household-card")).toHaveCount(partyCount);
  await expect(page.getByRole("button", { name: "Parties", exact: true })).toHaveClass(/selected/);
  await expect(page.locator(".party-directory-card")).toHaveCount(partyCount);
  await expect(page.locator(".directory-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Individual guests" }).click();
  await expect(page.locator(".directory-row")).toHaveCount(invitedCount);

  for (const label of ["All invited", "Yes — attending", "No — can’t attend", "Pending"]) {
    const button = page.locator(".stats-grid").getByRole("button", { name: new RegExp(label) });
    await button.click();
    await expect(button).toHaveClass(/selected/);
  }
  for (const label of ["Everyone", "Yes", "No", "Pending"]) {
    const button = page.getByRole("button", { name: label, exact: true }).last();
    await button.click();
    await expect(button).toHaveClass(/selected/);
  }

  await page.getByRole("button", { name: "Everyone", exact: true }).click();
  await page.getByRole("textbox", { name: "Search guests, parties, or short links" }).fill("Grace Ponticelle");
  await expect(page.locator(".directory-row")).toHaveCount(1);
  await expect(page.locator(".directory-row")).toContainText("Auntie Grace Ponticelle");
  await page.getByRole("textbox", { name: "Search guests, parties, or short links" }).fill("");

  const grace = page.locator("details.household-card").filter({ hasText: "Auntie Grace Ponticelle" });
  await grace.locator("summary").click();
  await grace.getByRole("button", { name: "Copy link" }).click();
  await expect(grace.getByRole("button", { name: "✓ Copied!" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("/invite/ponticelle");
  await grace.getByRole("button", { name: "Copy message" }).click();
  await expect(grace.getByRole("button", { name: "✓ Copied!" })).toBeVisible();
  const copiedMessage = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedMessage).toContain("Hi Auntie Grace!");
  expect(copiedMessage).toContain(`${new URL(process.env.PLAYWRIGHT_BASE_URL!).origin}/invite/ponticelle`);

  const previewEvent = context.waitForEvent("page");
  await grace.getByRole("link", { name: "Preview invitation" }).click();
  const preview = await previewEvent;
  await preview.waitForLoadState("domcontentloaded");
  await expect(preview.locator(".invite-screen")).toBeVisible();
  await expect(preview).toHaveURL(/\/invite\/ponticelle$/);
  await preview.close();

  const eventSave = page.waitForResponse((response) => response.url().endsWith("/api/admin/dashboard") && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "Save event details" }).click();
  expect((await eventSave).ok()).toBe(true);
  await expect(page.getByText("Changes saved.")).toBeVisible();
  const invitationSave = page.waitForResponse((response) => response.url().endsWith("/api/admin/dashboard") && response.request().method() === "PATCH");
  await grace.getByRole("button", { name: "Save this invitation" }).click();
  expect((await invitationSave).ok()).toBe(true);
  await expect(page.getByText("Changes saved.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open and verify the live Amazon registry" })).toHaveAttribute("href", "https://www.amazon.com/baby-reg/janelle-moncada-november-2026-rohnertpark/10AIJQD53FRAQ");

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Host dashboard" })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/login$/);
});

test("a submitted RSVP reaches the host dashboard with note and timestamp", async ({ context, page }) => {
  test.skip(process.env.RUN_LIVE_RSVP !== "1", "Only run against the controlled production release gate.");
  const note = `Controlled release gate ${Date.now()}`;
  await page.goto("/invite/ponticelle");
  await page.getByRole("button", { name: "RSVP", exact: true }).first().click();
  const changeResponse = page.getByRole("button", { name: "Change response" });
  const attendingButton = page.getByRole("button", { name: "Attending" });
  await Promise.any([
    changeResponse.waitFor({ state: "visible", timeout: 10_000 }),
    attendingButton.waitFor({ state: "visible", timeout: 10_000 }),
  ]);
  if (await changeResponse.isVisible()) await changeResponse.click();
  await attendingButton.click();
  await page.getByLabel(/Note for Janelle & Fernando/).fill(note);
  const save = page.waitForResponse((response) => response.url().includes("/api/rsvp") && response.request().method() === "POST");
  await page.getByRole("button", { name: /Confirm RSVP|Save changes/ }).click();
  expect((await save).ok()).toBe(true);
  await expect(page.getByText("Auntie Grace Ponticelle is attending.", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "RSVP", exact: true }).first().click();
  await expect(page.getByText(`“${note}”`, { exact: true })).toBeVisible();

  const dashboard = await context.newPage();
  await dashboard.goto("/dashboard");
  await dashboard.locator("input").first().fill("1991");
  await dashboard.getByRole("button", { name: "Open dashboard" }).click();
  await dashboard.getByRole("button", { name: "Individual guests" }).click();
  await dashboard.getByRole("textbox", { name: "Search guests, parties, or short links" }).fill("Grace Ponticelle");
  const row = dashboard.locator(".directory-row").filter({ hasText: "Auntie Grace Ponticelle" });
  await expect(row).toContainText("Yes — attending");
  await expect(row.locator("time")).not.toHaveText("Not replied yet");
  const household = dashboard.locator("details.household-card").filter({ hasText: "Auntie Grace Ponticelle" });
  await household.locator("summary").click();
  await expect(household).toContainText(note);

  await page.getByRole("button", { name: "Change response" }).click();
  await page.getByRole("button", { name: "Can’t make it" }).click();
  const change = page.waitForResponse((response) => response.url().includes("/api/rsvp") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Save changes" }).click();
  expect((await change).ok()).toBe(true);
  await expect(page.getByText("Auntie Grace Ponticelle can’t make it.", { exact: true })).toBeVisible();
  await dashboard.reload();
  await dashboard.getByRole("button", { name: "Individual guests" }).click();
  await dashboard.getByRole("textbox", { name: "Search guests, parties, or short links" }).fill("Grace Ponticelle");
  await expect(dashboard.locator(".directory-row").filter({ hasText: "Auntie Grace Ponticelle" })).toContainText("No — can’t attend");
});
