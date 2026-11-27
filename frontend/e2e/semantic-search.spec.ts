import { expect, test } from "@playwright/test";

test("semantic search submits once and shows ten products below the form", async ({ page }, info) => {
  test.setTimeout(90000);
  await page.goto("/finder");
  await expect(page.getByRole("heading", { level: 2, name: "جست‌وجوی معنایی" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "ناوبری اصلی" }).getByRole("link", { name: "کفش من" })).toBeVisible();
  let requests = 0;
  page.on("request", r => { if (r.url().endsWith("/api/search")) requests++; });
  await expect(page.locator(".semantic-placeholder")).toHaveCount(0);
  if (info.project.name === "desktop") {
    const manual = await page.locator(".finder-form").boundingBox();
    const semantic = await page.locator(".semantic-embedded").boundingBox();
    expect(Math.abs(manual!.width - semantic!.width)).toBeLessThan(2);
    expect(Math.abs(manual!.height - semantic!.height)).toBeLessThan(2);
    expect(manual!.x).toBeGreaterThan(semantic!.x);
  }
  await page.getByLabel("کفش مورد نظرت را توصیف کن").fill("کفش سبک برای دویدن روی آسفالت");
  expect(requests).toBe(0);
  const response = page.waitForResponse(r => r.url().endsWith("/api/search"));
  await page.getByRole("button", { name: "پیدا کردن کفش" }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  expect((await result.json()).mode).toBe("hybrid");
  await expect(page.locator(".semantic-grid .semantic-card")).toHaveCount(10);
  expect(requests).toBe(1);
  await expect(page.locator(".semantic-placeholder")).toHaveCount(0);
  await expect(page.locator(".semantic-card p").first()).not.toBeEmpty();
  await expect(page.getByRole("heading", { name: "10 محصول نزدیک" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `../.local/semantic-${info.project.name}.png`, fullPage: true });
});

test("semantic search shows retryable error and explicit lexical fallback", async ({ page }) => {
  await page.goto("/finder");
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
