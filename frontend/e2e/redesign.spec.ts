import { test, expect } from "@playwright/test";
test("reduced motion exposes all products and catalog browser back preserves filters", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".intro-flow article")).toHaveCount(4);
  await expect(page.locator(".intro-canvas")).toHaveCount(0);
  await page.goto("/shoes?brand=Nike&q=Pegasus&sort=weight");
  await page
    .getByRole("link", { name: "بررسی Nike Pegasus 41", exact: true })
    .click();
  await expect(page).toHaveURL(/\/shoes\/nike-pegasus-41/);
  await page.goBack();
  await expect(page.getByRole("searchbox")).toHaveValue("Pegasus");
  await expect(page.getByRole("combobox", { name: "مرتب‌سازی" })).toHaveValue(
    "weight",
  );
  await expect(page).toHaveURL(/brand=Nike/);
});
test("mapped galleries, fullscreen keyboard, focus, swipe and Persian reviews", async ({
  page,
}, info) => {
  await page.goto("/shoes/adidas-adizero-evo-sl");
  await page
    .getByRole("button", { name: "رنگ مشکی · JP7149", exact: true })
    .click();
  await expect(page.locator(".main-product-image img")).toHaveAttribute(
    "src",
    /\/i\/adidas\//,
  );
  const src = await page.locator(".main-product-image img").getAttribute("src");
  await expect(page.locator(".photo-thumbnails button")).toHaveCount(1);
  await expect(page.locator(".photo-thumbnails img")).toHaveAttribute(
    "src",
    src!,
  );
  await page.getByRole("button", { name: "تصاویر عمومی", exact: true }).click();
  const open = page.getByRole("button", { name: "باز کردن گالری تمام‌صفحه" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: /گالری adidas/ });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "بستن گالری" })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    "hidden",
  );
  const initial = await dialog.locator("img").getAttribute("src");
  await page.keyboard.press("ArrowRight");
  await expect(dialog.locator("img")).not.toHaveAttribute("src", initial!);
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.locator("img")).toHaveAttribute("src", initial!);
  if (info.project.name !== "desktop") {
    await dialog.locator(".gallery-full-image").evaluate((el) => {
      el.dispatchEvent(
        new TouchEvent("touchstart", {
          bubbles: true,
          touches: [
            new Touch({
              identifier: 1,
              target: el,
              clientX: 290,
              clientY: 200,
            }),
          ],
        }),
      );
      el.dispatchEvent(
        new TouchEvent("touchend", {
          bubbles: true,
          changedTouches: [
            new Touch({ identifier: 1, target: el, clientX: 90, clientY: 200 }),
          ],
        }),
      );
    });
    await expect(dialog.locator("img")).not.toHaveAttribute("src", initial!);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(open).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  await expect(page.locator(".pros li")).toHaveCount(8);
  for (const text of await page.locator(".pros li,.cons li").allTextContents())
    expect(text).toMatch(/[\u0600-\u06ff]/);
  const visible = await page.locator("main").innerText();
  expect(visible).not.toMatch(
    /RunRepeat|SoleHunt|ShoeGeometry|ثبت نشده|نامشخص|MSRP|€|\$\d|پیشنهادهای فروشگاه/,
  );
  await expect(page.locator(".histogram")).toHaveCount(4);
});
test("another category gets its own use scores and sparse material modes stay meaningful", async ({
  page,
}) => {
  await page.goto("/shoes/nike-p-6000");
  await expect(page.locator(".score-row")).not.toHaveCount(0);
  const labels = await page.locator(".score-row h3").allTextContents();
  expect(labels).not.toContain("دویدن روزانه");
  await page.getByRole("button", { name: "لایه‌های جدا", exact: true }).click();
  for (const layer of await page.locator(".layer-buttons button").all()) {
    await layer.click();
    expect(
      (await page.locator(".inspector-detail").innerText()).trim().length,
    ).toBeGreaterThan(10);
  }
  expect(await page.locator(".anatomy").innerText()).not.toMatch(
    /ثبت نشده|نامشخص/,
  );
});
