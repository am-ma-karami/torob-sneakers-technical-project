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
  const domestic = await page.request.get(
    "/api/shoes/adidas-adizero-evo-sl/offers?source=ShoeStoreLinks&market=iran&sort=price_toman&page_size=6",
  );
  expect(domestic.status()).toBe(200);
  const domesticBody = await domestic.json();
  expect(domesticBody.total).toBeGreaterThan(0);
  const firstDomestic = domesticBody.items[0];
  const firstRow = stores.locator(".store-offer").first();
  await expect(firstRow.getByRole("heading")).toHaveText(firstDomestic.retailer);
  await expect(firstRow.locator(".store-offer-price strong")).toContainText(
    new Intl.NumberFormat("en-US").format(firstDomestic.price_toman),
  );
  const domesticLink = firstRow.locator(".store-visit");
  const gateway = `/api/out/${domesticBody.shoe_id}/${firstDomestic.key}`;
  await expect(domesticLink).toHaveAttribute("href", gateway);
  const outbound = await page.request.get(gateway, { maxRedirects: 0 });
  expect(outbound.status()).toBe(302);
  expect(outbound.headers().location).toBe(firstDomestic.url);
  // Additional retailers can move older listings to later pages. They remain
  // independently accessible rather than being replaced by the new crawl.
  const legacy = await page.request.get(
    "/api/shoes/adidas-adizero-evo-sl/offers?source=ShoeStoreLinks&market=iran&retailer_id=digizenith.ir",
  );
  expect(legacy.status()).toBe(200);
  expect((await legacy.json()).items.some(
    (offer: { price_toman: number }) => offer.price_toman === 38990000,
  )).toBe(true);
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
