import { expect, test } from "@playwright/test";

test("boarding-pass design preserves Claude handoff geometry and typography", async ({ page }) => {
  await page.goto("/invite/murao");
  await expect(page.getByRole("heading", { name: "Baby Moncada" })).toBeVisible();
  await expect(page.getByText("A baby shower honoring Janelle & Fernando")).toBeVisible();
  await expect(page.getByText("RSVP by September 11, 2026")).toBeVisible();

  const design = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(".phone.boarding-pass")!;
    const header = document.querySelector<HTMLElement>(".ticket-header")!;
    const title = document.querySelector<HTMLElement>(".ticket-hero h1")!;
    const nav = document.querySelector<HTMLElement>(".phone-nav")!;
    const cardStyle = getComputedStyle(card);
    const headerStyle = getComputedStyle(header);
    const titleStyle = getComputedStyle(title);
    const navStyle = getComputedStyle(nav);
    return {
      cardWidth: card.getBoundingClientRect().width,
      cardRadius: cardStyle.borderRadius,
      cardFont: cardStyle.fontFamily,
      headerPadding: headerStyle.padding,
      titleFont: titleStyle.fontFamily,
      titleSize: titleStyle.fontSize,
      titleLineHeight: titleStyle.lineHeight,
      navBorder: navStyle.borderTopStyle,
      navBackground: navStyle.backgroundColor,
    };
  });

  expect(design.cardWidth).toBeLessThanOrEqual(430);
  expect(design.cardRadius).toBe("26px");
  expect(design.cardFont).toContain("IBM Plex Mono");
  expect(design.headerPadding).toBe("26px 24px 0px");
  expect(design.titleFont).toContain("Instrument Serif");
  expect(design.titleSize).toBe("42px");
  expect(design.titleLineHeight).toBe("44.1px");
  expect(design.navBorder).toBe("dashed");
  expect(design.navBackground).not.toBe("rgba(0, 0, 0, 0)");
});

test("all five Claude-designed screens fit and retain their exact labels", async ({ page }) => {
  await page.goto("/invite/murao");
  const expected = [
    ["Invite", "Baby Moncada"],
    ["Hotel", "Stay on site"],
    ["Registry", "Janelle’s registry"],
    ["Travel", "Shower & stay"],
    ["RSVP", "Who’s on board?"],
  ] as const;

  for (const [tab, heading] of expected) {
    await page.getByRole("navigation", { name: "Invitation features" }).getByRole("button", { name: tab, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  await page.getByRole("navigation", { name: "Invitation features" }).getByRole("button", { name: "RSVP", exact: true }).click();
  await expect(page.getByText("RSVP by September 11, 2026")).toBeVisible();
});
