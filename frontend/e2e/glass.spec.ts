import { test, expect } from "@playwright/test";
test("brand artwork stays correctly mapped, readable and undistorted", async ({
  page,
}) => {
  await page.goto("/brands");
  for (const [brand, file] of [
    ["Nike", "nike"],
    ["adidas", "adidas"],
    ["ASICS", "asics"],
    ["Saucony", "saucony"],
    ["Salomon", "salomon"],
  ]) {
    const mark = page.getByRole("img", { name: `نشان ${brand}`, exact: true });
    await mark.scrollIntoViewIfNeeded();
    await expect(mark).toHaveAttribute("src", `/media/brands/${file}.svg`);
    await expect
      .poll(() => mark.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    expect(await mark.evaluate((el) => getComputedStyle(el).objectFit)).toBe(
      "contain",
    );
    expect(await mark.evaluate((el) => getComputedStyle(el).filter)).toBe(
      "none",
    );
  }
  await expect(
    page.getByLabel("نام برند HIRACER", { exact: true }),
  ).toBeAttached();
  expect(await page.locator(".brand-directory>a>svg:first-child").count()).toBe(
    0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("opening uses transparent real-product assets and works without WebGL", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (String(type).startsWith("webgl")) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".studio-chapter")).toHaveCount(4);
  for (const img of await page.locator(".studio-product img").all()) {
    await img.scrollIntoViewIfNeeded();
    await img.evaluate((el: HTMLImageElement) => el.decode());
    expect(
      await img.evaluate((el: HTMLImageElement) => {
        const c = document.createElement("canvas");
        c.width = el.naturalWidth;
        c.height = el.naturalHeight;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(el, 0, 0, c.width, c.height);
        return ctx.getImageData(0, 0, 1, 1).data[3];
      }),
    ).toBe(0);
    expect(
      await img.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgba(0, 0, 0, 0)");
  }
  expect(
    await page
      .locator(".studio-chapter")
      .evaluateAll((nodes) =>
        nodes.every((n) => n.getAttribute("data-renderer") === "catalog-photo"),
      ),
  ).toBe(true);
  await page.locator(".studio-actions a.button").first().click();
  await expect(page).toHaveURL(/\/shoes$/);
});
test("layers separate, reassemble, replay and remain selectable after homepage navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".studio-actions a.quiet-link").first().click();
  const upper = page.locator(".exploded-layer[data-layer=upper]");
  const y = () => upper.evaluate((el: SVGGraphicsElement) => el.getCTM()!.f);
  await page.locator(".anatomy").scrollIntoViewIfNeeded();
  const assembled = await y();
  await page.getByRole("button", { name: "لایه‌های جدا", exact: true }).click();
  await expect
    .poll(async () => Math.abs((await y()) - assembled))
    .toBeGreaterThan(25);
  await expect(
    page.getByRole("button", { name: "مونتاژ دوباره", exact: true }),
  ).toBeVisible();
  const insole = page.getByRole("button", {
    name: "انتخاب کفی داخلی",
    exact: true,
  });
  await insole.focus();
  await page.keyboard.press("Enter");
  await expect(insole).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".inspector-detail")).toContainText("mm");
  await page
    .getByRole("button", { name: "مونتاژ دوباره", exact: true })
    .click();
  await expect
    .poll(async () => Math.abs((await y()) - assembled))
    .toBeLessThan(1);
  await page
    .getByRole("button", { name: "بازپخش جداسازی لایه‌ها", exact: true })
    .click();
  await expect
    .poll(async () => Math.abs((await y()) - assembled))
    .toBeGreaterThan(25);
  const drawn = page.getByRole("button", {
    name: "لایهٔ رویه در طرح",
    exact: true,
  });
  await drawn.focus();
  await page.keyboard.press("Space");
  await expect(drawn).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "راد، صفحه اصلی", exact: true }).click();
  await expect(page.locator(".anatomy")).toHaveCount(0);
});
test("reduced motion keeps immediate assembled and exploded states", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/shoes/adidas-adizero-evo-sl");
  await page.getByRole("button", { name: "لایه‌های جدا", exact: true }).click();
  await expect(page.locator(".exploded-layer").first()).toHaveAttribute(
    "data-pose",
    "exploded",
  );
  await page
    .getByRole("button", { name: "مونتاژ دوباره", exact: true })
    .click();
  await expect(page.locator(".exploded-layer").first()).toHaveAttribute(
    "data-pose",
    "assembled",
  );
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => {
          const target = (a.effect as KeyframeEffect)?.target;
          return (
            target instanceof Element &&
            target.closest(".anatomy") &&
            a.playState === "running" &&
            Number(a.effect?.getTiming().duration) > 0
          );
        }).length,
    ),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
