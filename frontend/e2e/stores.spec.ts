import { test, expect } from "@playwright/test";
import path from "node:path";

test("domestic and foreign store prices stay in toman with a visible conversion source", async ({
  page,
}, info) => {
  await page.goto("/shoes/adidas-adizero-evo-sl");
  const stores = page.getByRole("region", { name: "قیمت و فروشگاه‌ها" });
  await stores.scrollIntoViewIfNeeded();
  await expect(stores.locator(".store-offer").first()).toBeVisible();
  const iran = stores.getByRole("button", { name: /^ایران/ });
  await iran.focus();
  await iran.press("Enter");
  await expect(iran).toHaveAttribute("aria-pressed", "true");
  await expect(
    stores.getByRole("heading", { name: "digizenith.ir" }),
  ).toBeVisible();
  await expect(stores.getByText("38,990,000", { exact: true })).toBeVisible();
  await expect(stores.getByText("38,890,000", { exact: true })).toBeVisible();
  await stores.getByRole("button", { name: /^خارج از ایران/ }).click();
  await expect(
    stores.getByRole("heading", { name: "مبنای تبدیل قیمت خارجی" }),
  ).toBeVisible();
  const response = await page.request.get(
    "/api/shoes/adidas-adizero-evo-sl/offers?source=ShoeStoreLinks&market=foreign&sort=price_toman&page_size=6",
  );
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.items[0].price_toman).toBeGreaterThan(0);
  await expect(
    stores.locator(".store-offer-price strong").first(),
  ).toContainText(
    new Intl.NumberFormat("en-US").format(body.items[0].price_toman),
  );
  await expect(
    stores.getByRole("link", { name: "TGJU · بازار آزاد" }).first(),
  ).toBeVisible();
  await expect(stores.getByText(/دریافت نرخ:/).first()).toBeVisible();
  const link = stores.locator(".store-visit").first();
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  expect(await stores.textContent()).not.toMatch(/[۰-۹٠-٩]/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await stores.screenshot({
    path: path.resolve(
      process.cwd(),
      `../.local/store-offers-${info.project.name}.png`,
    ),
  });
});
