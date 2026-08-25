import { expect, test } from "@playwright/test";

test("each invitation advertises a manifest that reopens that exact short link", async ({ page, request }) => {
  for (const slug of ["ponticelle", "murao"]) {
    await page.goto(`/invite/${slug}`);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", `/invite/${slug}/manifest.webmanifest`);

    const response = await request.get(`/invite/${slug}/manifest.webmanifest`);
    expect(response.ok()).toBeTruthy();
    const manifest = await response.json();
    expect(manifest.id).toBe(`/invite/${slug}`);
    expect(manifest.start_url).toBe(`/invite/${slug}`);
  }
});

test("the dashboard has a separate install identity and direct launch destination", async ({ page, request }) => {
  await page.goto("/dashboard/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/dashboard/manifest.webmanifest");

  const response = await request.get("/dashboard/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.id).toBe("/dashboard");
  expect(manifest.start_url).toBe("/dashboard");
});
