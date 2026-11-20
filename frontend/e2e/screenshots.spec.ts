import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
test("capture catalog, assembled anatomy, exploded anatomy and comparison", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const dir = path.resolve(process.cwd(), "../docs/screenshots");
  await fs.mkdir(dir, { recursive: true });
  const save = async (name: string) =>
    page.screenshot({
      path: path.join(dir, `${name}-${info.project.name}.png`),
      animations: "disabled",
    });
  await page.goto("/");
  await expect(page.locator(".shoe-card").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page
        .locator(".hero-shoe img")
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBeGreaterThan(0);
  await save("home");
  await page
    .locator("#catalog")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await expect
    .poll(() =>
      page
        .locator(".card-image-wrap img")
        .first()
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".card-image-wrap img"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top < innerHeight && r.bottom > 0;
      })
      .every((el) => (el as HTMLImageElement).complete),
  );
  await save("catalog");
  await page.goto("/shoe/adidas-adizero-evo-sl?colorway=1986833");
  await expect(
    page.getByRole("heading", { name: "adidas Adizero EVO SL", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ساختار کامل", exact: true }).click();
  await page
    .locator(".anatomy")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await save("anatomy");
  await page.getByRole("button", { name: "لایه‌های جدا", exact: true }).click();
  await page.getByRole("button", { name: "کفی داخلی", exact: true }).click();
  await page
    .locator(".anatomy")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await expect
    .poll(() =>
      page
        .locator(".shoe-layer")
        .first()
        .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42),
    )
    .toBeCloseTo(105, 0);
  await save("exploded");
  await page.goto("/compare?ids=40586,40390");
  await expect(page.locator(".comparison-product")).toHaveCount(2);
  await page
    .locator(".comparison-scroll")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await expect
    .poll(() =>
      page
        .locator(".comparison-product img")
        .first()
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBeGreaterThan(0);
  await save("comparison");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
