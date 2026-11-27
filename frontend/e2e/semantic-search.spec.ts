import { expect, test } from "@playwright/test";

test("semantic search submits once and shows ten products below the form", async ({ page }, info) => {
  test.setTimeout(90000);
  await page.goto("/semantic-search");
  await expect(page.getByRole("heading", { level: 1, name: "جست‌وجوی معنایی" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "ناوبری اصلی" }).getByRole("link", { name: "جست‌وجوی معنایی" })).toBeVisible();
  let requests = 0;
  page.on("request", r => { if (r.url().endsWith("/api/search")) requests++; });
  await page.getByLabel("کفش مورد نظرت را توصیف کن").fill("کفش سبک برای دویدن روی آسفالت");
  expect(requests).toBe(0);
  const response = page.waitForResponse(r => r.url().endsWith("/api/search"));
  await page.getByRole("button", { name: "پیدا کردن کفش" }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  expect((await result.json()).mode).toBe("hybrid");
  await expect(page.locator(".semantic-grid .shoe-card")).toHaveCount(10);
  expect(requests).toBe(1);
  await expect(page.locator(".semantic-grid .shoe-card").first()).toHaveCSS("opacity", "1");
  await expect(page.getByRole("heading", { name: "10 محصول نزدیک" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `../.local/semantic-${info.project.name}.png`, fullPage: true });
});

test("semantic search shows retryable error and explicit lexical fallback", async ({ page }) => {
  await page.goto("/semantic-search");
  await page.route("**/api/search", route => route.fulfill({ status: 503, body: "{}" }));
  await page.getByLabel("کفش مورد نظرت را توصیف کن").fill("کفش نرم");
  await page.getByRole("button", { name: "پیدا کردن کفش" }).click();
  await expect(page.getByRole("alert")).toContainText("دوباره تلاش کنید");
  await page.unroute("**/api/search");
  await page.route("**/api/search", route => route.fulfill({ json: { items: [], mode: "lexical_fallback" } }));
  await page.getByRole("button", { name: "پیدا کردن کفش" }).click();
  await expect(page.getByText("جست‌وجوی معنایی فعلاً در دسترس نیست", { exact: false })).toBeVisible();
  await expect(page.getByText("محصولی پیدا نشد.", { exact: false })).toBeVisible();
});
