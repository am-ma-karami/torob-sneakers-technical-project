import { expect, test } from "@playwright/test";

test("semantic search submits once and shows nine products below the form", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.goto("/finder");
  await page
    .getByRole("group", { name: "روش جست‌وجو" })
    .getByRole("button", { name: "مشاور هوشمند", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { level: 2, name: "بگو دنبال چه کفشی هستی" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "ناوبری اصلی" })
      .getByRole("link", { name: "کفش من" }),
  ).toBeVisible();
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/search")) requests++;
  });
  await expect(page.locator(".semantic-placeholder")).toHaveCount(0);
  await page
    .getByLabel("کفش مورد نظرت را توصیف کن")
    .fill("کفش سبک برای دویدن روی آسفالت");
  expect(requests).toBe(0);
  const response = page.waitForResponse((r) => r.url().endsWith("/api/search"));
  await page
    .getByRole("button", { name: "پیدا کردن کفش با هوش مصنوعی", exact: true })
    .click();
  const result = await response;
  expect(result.status()).toBe(200);
  expect(result.request().postDataJSON()).toMatchObject({
    hard_filters: {},
    preferences: {},
    limit: 9,
  });
  expect((await result.json()).mode).toBe("advisor");
  await expect(page.locator(".finder-grid .shoe-card")).toHaveCount(9);
  expect(requests).toBe(1);
  await expect(page.locator("#finder-results")).toHaveCount(1);
  await expect(page.locator(".finder-grid .compare-add")).toHaveCount(9);
  await page.locator(".finder-grid .compare-add").first().click();
  await expect(
    page.locator(".finder-grid .compare-add").first(),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".semantic-placeholder")).toHaveCount(0);
  await expect(page.locator(".match-explanation p").first()).not.toBeEmpty();
  await expect(page.locator(".finder-scoreline bdi").first()).toHaveAttribute(
    "dir",
    "ltr",
  );
  await expect(page.locator(".card-score").first()).toHaveAttribute(
    "dir",
    "ltr",
  );
  await expect(page.locator("#finder-results")).not.toContainText("پوشش داده");
  await expect(
    page.getByRole("heading", { name: "گزینه‌هایی برای مقایسه" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `../.local/semantic-${info.project.name}.png`,
    fullPage: true,
  });
});

test("semantic search shows retryable error and explicit manual-only fallback", async ({
  page,
}) => {
  await page.goto("/finder");
  await page
    .getByRole("group", { name: "روش جست‌وجو" })
    .getByRole("button", { name: "مشاور هوشمند", exact: false })
    .click();
  await page.route("**/api/search", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await page.getByLabel("کفش مورد نظرت را توصیف کن").fill("کفش نرم");
  await page
    .getByRole("button", { name: "پیدا کردن کفش با هوش مصنوعی", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("ارتباط با کاتالوگ");
  await page.unroute("**/api/search");
  await page.route("**/api/search", (route) =>
    route.fulfill({
      json: { items: [], mode: "hybrid", status: "manual_filter_only" },
    }),
  );
  await page
    .getByRole("button", { name: "پیدا کردن کفش با هوش مصنوعی", exact: true })
    .click();
  await expect(
    page.getByText("متن درخواست بررسی نشد", { exact: false }),
  ).toBeVisible();
});

test("mode switching isolates drafts and reset clears all input", async ({
  page,
}) => {
  test.setTimeout(90000);
  const mode = (name: string) =>
    page
      .getByRole("group", { name: "روش جست‌وجو" })
      .getByRole("button", { name, exact: false })
      .click();
  await page.goto("/finder");
  await expect(page.locator("#finder-filters")).toHaveCount(0);
  await mode("جست‌وجوی پیشرفته");
  await page.getByLabel("افزودن برند").selectOption("adidas");
  await page.getByText("سقف وزن و دراپ", { exact: true }).click();
  await page.getByLabel("حداکثر وزن (گرم)").fill("۲۵۰");
  await mode("مشاور هوشمند");
  await expect(page.locator(".finder-form")).toHaveCount(0);
  await page.locator(".semantic-examples button").first().click();
  await page
    .getByLabel("کفش مورد نظرت را توصیف کن")
    .fill("کفش سبک برای دویدن روی آسفالت");
  let response = page.waitForResponse("**/api/search");
  await page.getByLabel("کفش مورد نظرت را توصیف کن").press("Control+Enter");
  expect((await response).request().postDataJSON()).toMatchObject({
    mode: "advisor",
    hard_filters: {},
    preferences: {},
  });
  await expect(page.locator(".finder-grid .shoe-card")).toHaveCount(9);
  await mode("جست‌وجوی ترکیبی");
  await expect(page.getByLabel("حداکثر وزن (گرم)")).toHaveValue("۲۵۰");
  await expect(page.getByLabel("کفش مورد نظرت را توصیف کن")).toHaveValue(
    "کفش سبک برای دویدن روی آسفالت",
  );
  response = page.waitForResponse("**/api/search");
  await page
    .getByRole("button", { name: "پیدا کردن بهترین گزینه‌ها", exact: true })
    .click();
  expect((await response).request().postDataJSON()).toMatchObject({
    mode: "hybrid",
    q: "کفش سبک برای دویدن روی آسفالت",
    hard_filters: { brand: ["adidas"], weight_max: 250 },
  });
  await expect(page.locator(".finder-grid .shoe-card")).toHaveCount(9);
  await mode("جست‌وجوی پیشرفته");
  response = page.waitForResponse("**/api/search");
  await page
    .getByRole("button", { name: "پیدا کردن کفش مناسب", exact: true })
    .click();
  expect((await response).request().postDataJSON()).toMatchObject({
    mode: "advanced",
    q: "",
  });
  await page
    .getByRole("button", { name: "پاک کردن انتخاب‌ها", exact: true })
    .click();
  await expect(page.locator("#finder-results")).toHaveCount(0);
  await expect(page.getByLabel("حداکثر وزن (گرم)")).toHaveValue("");
  await mode("مشاور هوشمند");
  await expect(page.locator("#semantic-query")).toHaveValue("");
});

test("empty suggestions, conflict evidence and unavailable advisor are actionable", async ({
  page,
}) => {
  await page.goto("/finder");
  await page
    .getByRole("group", { name: "روش جست‌وجو" })
    .getByRole("button", { name: "مشاور هوشمند", exact: false })
    .click();
  await page.getByLabel("کفش مورد نظرت را توصیف کن").fill("کفش نرم");
  await page.route("**/api/search", (route) =>
    route.fulfill({
      json: {
        items: [],
        mode: "advisor",
        status: "no_matches",
        suggested_adjustments: [
          { field: "weight_max", products_if_removed: 12 },
        ],
      },
    }),
  );
  const submit = () =>
    page
      .getByRole("button", { name: "پیدا کردن کفش با هوش مصنوعی", exact: true })
      .click();
  await submit();
  await expect(
    page.getByText("کفشی مطابق با همه شرایطت پیدا نکردیم."),
  ).toBeVisible();
  await expect(page.getByText(/12 گزینه از نظر/)).toBeVisible();
  await page.unroute("**/api/search");
  await page.route("**/api/search", (route) =>
    route.fulfill({
      json: {
        items: [],
        mode: "hybrid",
        status: "conflict",
        conflicts: [
          {
            field: "brand",
            manual: ["Nike"],
            text: ["adidas"],
            blocking: true,
          },
        ],
      },
    }),
  );
  await submit();
  await expect(page.getByRole("alert")).toContainText("Nike");
  await expect(page.getByRole("alert")).toContainText("adidas");
  await page.getByRole("button", { name: "اصلاح شرط یا متن" }).click();
  await expect(page.locator("#semantic-query")).toBeFocused();
  await page.unroute("**/api/search");
  await page.route("**/api/search", (route) =>
    route.fulfill({
      json: { items: [], mode: "advisor", status: "intent_unavailable" },
    }),
  );
  await submit();
  await page.getByRole("button", { name: "ادامه با جست‌وجوی پیشرفته" }).click();
  await expect(page.locator("#semantic-query")).toHaveCount(0);
});

test("mode selection and hybrid panels fit small screens and reduced motion", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/finder");
  await page.screenshot({
    path: `../.local/finder-modes-${info.project.name}.png`,
  });
  await page
    .getByRole("group", { name: "روش جست‌وجو" })
    .getByRole("button", { name: "جست‌وجوی ترکیبی", exact: false })
    .click();
  await expect(
    page
      .getByRole("group", { name: "روش جست‌وجو" })
      .getByRole("button", { name: "جست‌وجوی ترکیبی", exact: false }),
  ).toHaveAttribute("aria-pressed", "true");
  if (info.project.name === "desktop") {
    const manual = await page.locator(".finder-form").boundingBox();
    const semantic = await page.locator(".semantic-embedded").boundingBox();
    expect(manual!.x).toBeGreaterThan(semantic!.x);
    expect(Math.abs(manual!.width - semantic!.width)).toBeLessThan(2);
  }
  await page
    .getByRole("button", { name: "پیدا کردن بهترین گزینه‌ها", exact: true })
    .click();
  await expect(page.locator("#finder-input-error")).toBeFocused();
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `../.local/finder-hybrid-${info.project.name}.png`,
    fullPage: true,
  });
  if (info.project.name === "mobile") {
    await page.setViewportSize({ width: 812, height: 375 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
