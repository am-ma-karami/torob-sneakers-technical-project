import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
test("capture redesigned destinations and measured modes", async ({
  page,
}, info) => {
  await page.emulateMedia({
    reducedMotion: info.project.name === "desktop" ? "no-preference" : "reduce",
  });
  const dir = path.resolve(process.cwd(), "../docs/glass-studio/after");
  await fs.mkdir(dir, { recursive: true });
  const save = async (name: string) => {
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("main>div")).toHaveCSS("opacity", "1");
    await page.locator("img").evaluateAll(async (nodes) => {
      await Promise.all(
        nodes
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.top < innerHeight && r.bottom > 0;
          })
          .map((el) => (el as HTMLImageElement).decode().catch(() => {})),
      );
    });
    await page.screenshot({
      path: path.join(dir, `${name}-${info.project.name}.png`),
      animations: "disabled",
    });
  };
  await page.goto("/");
  await expect
    .poll(() =>
      page
        .locator(".studio-product img")
        .first()
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBeGreaterThan(0);
  if (info.project.name === "desktop")
    await expect(page.locator(".studio-opening")).toHaveClass(/is-pinned/);
  await save("home");
  if (info.project.name === "desktop") {
    await page
      .getByRole("button", { name: "نمایش ASICS Novablast 6", exact: true })
      .click();
    await expect(page.locator(".showcase-live .studio-model")).toHaveText(
      "ASICS Novablast 6",
    );
    await page
      .locator(".showcase-live img")
      .evaluate((el: HTMLImageElement) => el.decode());
    await save("showcase-asics");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/brands");
  await expect(page.locator(".brand-directory>a").first()).toBeVisible();
  await save("brands");
  await page.goto("/shoes");
  await expect(page.locator(".shoe-card").first()).toBeVisible();
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
  await page.goto("/shoes/adidas-adizero-evo-sl?colorway=1986833");
  await expect(page.locator(".product-summary h1")).toHaveText(
    "adidas Adizero EVO SL",
  );
  await expect
    .poll(() =>
      page
        .locator(".main-product-image img")
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBeGreaterThan(0);
  await save("product");
  for (const [mode, name] of [
    ["ساختار کامل", "anatomy"],
    ["نمای جانبی", "profile"],
    ["فضای داخلی", "fit"],
    ["لایه‌های جدا", "exploded"],
  ]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await page
      .locator(".anatomy")
      .evaluate((el) => el.scrollIntoView({ block: "start" }));
    if (mode === "لایه‌های جدا")
      await page
        .getByRole("button", { name: "انتخاب کفی داخلی", exact: true })
        .click();
    await save(name);
  }
  await page.goto("/compare?ids=40586,40390");
  await expect(page.locator(".comparison-product")).toHaveCount(2);
  await page
    .locator(".comparison-scroll")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await save("comparison");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
