import { expect, test } from "@playwright/test";

test("top categories replace selection while sidebar keeps OR selection", async ({
  page,
}, info) => {
  await page.goto(
    "/shoes?brand=adidas&category=hiking-shoes&category=walking-shoes&sort=weight&page=2",
  );
  const tabs = page.getByRole("navigation", { name: "دسته‌های کفش" });
  const walking = tabs.getByRole("button", { name: /پیاده‌روی/ });
  const hiking = tabs.getByRole("button", { name: /^طبیعت‌گردی(?:\s|$)/ });
  await expect(walking).toHaveAttribute("aria-pressed", "false");
  await expect(hiking).toHaveAttribute("aria-pressed", "false");
  await walking.click();
  await expect(walking).toHaveAttribute("aria-pressed", "true");
  let url = new URL(page.url());
  expect(url.searchParams.getAll("category")).toEqual(["walking-shoes"]);
  expect(url.searchParams.get("brand")).toBe("adidas");
  expect(url.searchParams.get("sort")).toBe("weight");
  expect(url.searchParams.has("page")).toBe(false);
  // Selecting the current top category is idempotent, rather than deselecting it.
  await walking.click();
  await expect(walking).toHaveAttribute("aria-pressed", "true");
  expect(new URL(page.url()).searchParams.getAll("category")).toEqual([
    "walking-shoes",
  ]);
  await hiking.click();
  await expect(hiking).toHaveAttribute("aria-pressed", "true");
  await expect(walking).toHaveAttribute("aria-pressed", "false");
  expect(new URL(page.url()).searchParams.getAll("category")).toEqual([
    "hiking-shoes",
  ]);

  await tabs.getByRole("button", { name: /همه کفش‌ها/ }).click();
  expect(new URL(page.url()).searchParams.has("category")).toBe(false);
  expect(new URL(page.url()).searchParams.get("brand")).toBe("adidas");
  // Test the sidebar without a brand that has no walking models in the dataset.
  await page.goto("/shoes?category=hiking-shoes&sort=weight");

  let filters = page.locator(".desktop-filters");
  if (info.project.name !== "desktop") {
    await page
      .getByRole("button", { name: /فیلترها/ })
      .first()
      .click();
    filters = page.getByRole("dialog", { name: "فیلتر کفش‌ها" });
  }
  const categoryGroup = filters
    .locator(".filter-group")
    .filter({ has: page.locator("summary", { hasText: "دسته‌بندی" }) });
  await categoryGroup.getByRole("button", { name: /نمایش همه/ }).click();
  const walkingCheck = filters.getByRole("checkbox", { name: /پیاده‌روی/ });
  const hikingCheck = filters.getByRole("checkbox", {
    name: /^طبیعت‌گردی(?:\s|$)/,
  });
  await expect(hikingCheck).toBeChecked();
  await walkingCheck.click();
  await expect(walkingCheck).toBeChecked();
  await expect(hikingCheck).toBeChecked();
  expect(new URL(page.url()).searchParams.getAll("category").sort()).toEqual([
    "hiking-shoes",
    "walking-shoes",
  ]);
  await hikingCheck.click();
  await expect(walkingCheck).toBeChecked();
  expect(new URL(page.url()).searchParams.getAll("category")).toEqual([
    "walking-shoes",
  ]);
  if (info.project.name !== "desktop")
    await page.getByRole("button", { name: "بستن فیلترها" }).click();
  await tabs.getByRole("button", { name: /همه کفش‌ها/ }).click();
  await expect(
    tabs.getByRole("button", { name: /همه کفش‌ها/ }),
  ).toHaveAttribute("aria-pressed", "true");
  url = new URL(page.url());
  expect(url.searchParams.has("category")).toBe(false);
  expect(url.searchParams.get("sort")).toBe("weight");
  await page.goBack();
  await expect(walking).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
