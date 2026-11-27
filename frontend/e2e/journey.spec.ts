import { test, expect } from "@playwright/test";
test("search, filter, inspect layers, select a verified color and compare two models", async ({
  page,
}) => {
  await page.goto("/?q=adidas+Adizero+EVO+SL");
  await expect(page.getByRole("searchbox")).toHaveValue(
    "adidas Adizero EVO SL",
  );
  await page
    .getByRole("navigation", { name: "دسته‌های کفش" })
    .getByRole("button", { name: /دویدن/ })
    .click();
  await expect(page).toHaveURL(/category=running-shoes/);
  await page
    .getByRole("link", { name: "بررسی adidas Adizero EVO SL", exact: true })
    .click();
  await page
    .getByRole("button", { name: "رنگ مشکی · JP7149", exact: true })
    .click();
  await expect(page).toHaveURL(/colorway=1986833/);
  const product = page.locator(".main-product-image img");
  await expect(product).toHaveAttribute("src", /cdn\.runrepeat\.com\/i\//);
  await expect
    .poll(() => product.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "لایه‌های جدا", exact: true }).click();
  const upper = page.getByRole("button", { name: "انتخاب رویه", exact: true });
  await upper.focus();
  await upper.press("Enter");
  await expect(upper).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "مقایسه با کفش دیگر" }).click();
  const display = page.getByRole("button", { name: /نمایش مقایسه/ });
  await expect(display).toBeDisabled();
  await page
    .getByRole("searchbox", { name: "جستجو و انتخاب کفش" })
    .fill("Nike Pegasus");
  await page
    .getByRole("button", { name: "انتخاب Nike Pegasus 41", exact: true })
    .click();
  await expect(display).toBeEnabled();
  await display.click();
  const table = page.locator(".comparison-table");
  await expect(
    table.getByRole("link", { name: "adidas Adizero EVO SL", exact: true }),
  ).toBeVisible();
  await expect(
    table.getByRole("link", { name: "Nike Pegasus 41", exact: true }),
  ).toBeAttached();
  await expect(page).toHaveURL(/variant_40586=1986833/);
  await page.getByRole("checkbox", { name: "فقط تفاوت‌ها" }).check();
  await expect(
    page.getByRole("checkbox", { name: "فقط تفاوت‌ها" }),
  ).toBeChecked();
  await expect(table.getByText("نقاط قوت", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "حذف Nike Pegasus 41 از مقایسه", exact: true })
    .click();
  await expect(
    table.getByRole("link", { name: "Nike Pegasus 41", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("URL restoration and responsive filter focus", async ({ page }, info) => {
  await page.goto("/?brand=Nike&sort=weight&page=2");
  await expect(page.getByRole("combobox", { name: "مرتب‌سازی" })).toHaveValue(
    "weight",
  );
  if (info.project.name !== "desktop") {
    const trigger = page.getByRole("button", { name: /فیلترها/ }).first();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "فیلتر کفش‌ها" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: /Nike/ })).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
  await page.reload();
  await expect(page.getByRole("combobox", { name: "مرتب‌سازی" })).toHaveValue(
    "weight",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("reduced motion, sparse geometry and interrupted state changes remain usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/shoe/nike-p-6000");
  await page.getByRole("button", { name: "لایه‌های جدا", exact: true }).click();
  await page.getByRole("button", { name: "ساختار کامل", exact: true }).click();
  await page.getByRole("button", { name: "فضای داخلی", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "فضای داخلی", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "نمای جانبی", exact: true }).click();
  await expect(page.locator('[data-measurement="toe_rocker_pct"]')).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "ساختار کامل", exact: true }).click();
  const layer = page.getByRole("button", {
    name: "انتخاب زیره خارجی",
    exact: true,
  });
  await layer.focus();
  await layer.press("Space");
  await expect(layer).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("empty results, broken images and API retry have usable fallbacks", async ({
  page,
}) => {
  await page.goto("/?q=zzzz-no-such-shoe-zzzz");
  await expect(page.getByText("کفشی با این ترکیب پیدا نشد.")).toBeVisible();
  await page.route("**/api/catalog?**", (route) => route.abort());
  await page.getByRole("button", { name: "شروع دوباره", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "ارتباط با کاتالوگ برقرار نشد",
  );
  await page.unroute("**/api/catalog?**");
  await page
    .getByRole("alert")
    .getByRole("button", { name: "تلاش دوباره" })
    .click();
  await expect(page.locator(".shoe-card").first()).toBeVisible();
  await page.route("https://cdn.runrepeat.com/**", (route) => route.abort());
  await page.goto("/shoe/adidas-adizero-evo-sl");
  await expect(
    page.locator(".main-product-image .image-fallback"),
  ).toBeVisible();
});
test("preference finder explains real recommendations", async ({ page }) => {
  await page.goto("/finder");
  const brand = page.getByRole("combobox", { name: "افزودن برند" });
  await brand.selectOption("adidas");
  await brand.selectOption("Nike");
  await page.getByText("سقف وزن و دراپ", { exact: true }).click();
  await page.getByLabel("حداکثر وزن (گرم)").fill("۲۵۰");
  await page.getByLabel("حداکثر دراپ (میلی‌متر)").fill("۸");
  await page.getByRole("radio", { name: "جادار", exact: true }).check();
  await page
    .getByRole("radio", { name: "سبک · تا 250 گرم", exact: true })
    .check();
  const submitted = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/api/search",
  );
  await page
    .getByRole("button", { name: "پیدا کردن گزینه‌ها", exact: true })
    .click();
  expect((await submitted).postDataJSON()).toMatchObject({
    hard_filters: { brand: ["adidas", "Nike"], weight_max: 250, drop_max: 8 },
    limit: 9,
  });
  expect((await submitted).postDataJSON().q).toBe("");
  expect((await submitted).postDataJSON().preferences).toMatchObject({ width: "wide", weight: "light" });
  await expect(page.locator(".match-explanation").first()).not.toBeEmpty();
  for (const check of await page.locator(".finder-result .card-meta").all()) {
    await expect(check.getByRole("link").first()).toHaveText(/^(adidas|Nike)$/);
  }
  await expect(page.locator("#finder-results")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("numeric bounds apply together and restore from the URL", async ({
  page,
}, info) => {
  await page.goto("/shoes");
  if (info.project.name !== "desktop")
    await page
      .getByRole("button", { name: /فیلترها/ })
      .first()
      .click();
  const scope =
    info.project.name === "desktop"
      ? page.locator(".desktop-filters")
      : page.getByRole("dialog", { name: "فیلتر کفش‌ها" });
  const range = scope.getByTestId("range-weight");
  await range.locator("summary").click();
  await range.locator("input[name=min]").fill("200");
  await range.locator("input[name=max]").fill("250");
  await range.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await expect(page).toHaveURL(/weight_min=200/);
  await expect(page).toHaveURL(/weight_max=250/);
  if (info.project.name !== "desktop") await page.keyboard.press("Escape");
  await expect
    .poll(() => page.locator(".shoe-card").count())
    .toBeGreaterThan(0);
});

test("comparison selection is searchable from navigation, keeps four picks and edits a shared result", async ({
  page,
}) => {
  await page.goto("/compare");
  const picker = page.locator(".compare-picker");
  const search = picker.getByRole("searchbox");
  const submit = picker.getByRole("button", { name: /نمایش مقایسه/ });
  await expect(submit).toBeDisabled();
  await search.fill("zz-missing-12345");
  await expect(picker.getByText("کفشی با این نام پیدا نشد.")).toBeVisible();
  await picker.getByRole("button", { name: "پاک کردن جستجو" }).click();
  const choices = picker.locator(".picker-results button");
  for (let i = 0; i < 4; i++) await choices.nth(i).click();
  await expect(choices.nth(4)).toBeDisabled();
  await expect(submit).toContainText("4");
  await picker.locator(".picker-selection li button").first().click();
  await expect(choices.nth(4)).toBeEnabled();
  await page.reload();
  await expect(page.locator(".picker-selection li")).toHaveCount(3);
  await page.goto("/compare?ids=40586,40390&variant_40586=1986833");
  await page.getByRole("link", { name: "ویرایش انتخاب‌ها" }).click();
  await expect(page.locator(".picker-selection li")).toHaveCount(2);
  await search.fill("Saucony Endorphin Speed 5");
  await picker
    .getByRole("button", {
      name: "انتخاب Saucony Endorphin Speed 5",
      exact: true,
    })
    .click();
  await page.reload();
  await expect(page.locator(".picker-selection li")).toHaveCount(3);
  await submit.click();
  await expect(page.locator(".comparison-product")).toHaveCount(3);
  await expect(page).toHaveURL(/variant_40586=1986833/);
  await expect(
    page.getByRole("checkbox", { name: "فقط تفاوت‌ها" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
