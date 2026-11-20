import { test, expect, type Locator } from "@playwright/test";

const ids = [40586, 40390, 41349, 40830];
const names = [
  "adidas Adizero EVO SL",
  "Nike Pegasus 41",
  "ASICS Novablast 6",
  "Saucony Endorphin Speed 5",
];

async function scrollIntro(intro: Locator, progress: number) {
  return intro.evaluate((element, p) => {
    const sticky = element.querySelector<HTMLElement>(".intro-sticky")!;
    const inset = parseFloat(getComputedStyle(sticky).top);
    const origin = element.getBoundingClientRect().top + scrollY - inset;
    const distance = element.clientHeight - sticky.offsetHeight;
    scrollTo({ top: origin + p * distance, behavior: "instant" });
  }, progress);
}

test("actual WebGL draws rotating four-shoe sequence and releases into the home page", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const draw = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (
      mode,
      count,
      type,
      offset,
    ) {
      if (mode === this.TRIANGLES && count > 300)
        (this.canvas as HTMLCanvasElement).dataset.triangles = String(
          count / 3,
        );
      return draw.call(this, mode, count, type, offset);
    };
  });
  await page.goto("/");
  const intro = page.locator(".shoe-intro");
  const canvas = intro.locator("canvas");
  await expect(intro).toHaveAttribute("data-renderer", "webgl");
  await expect(canvas).toHaveAttribute("data-triangles", /\d+/);
  const home = page.locator("#home-title");
  await expect(home).not.toBeInViewport();
  await expect(page.locator(".shoe-card, [role=searchbox]")).toHaveCount(0);

  const sequence = intro.locator(".intro-live-chapter");
  for (const [index, id] of ids.entries()) {
    await page
      .getByRole("button", { name: `نمایش ${names[index]}`, exact: true })
      .click();
    await expect(sequence).toHaveAttribute("data-shoe-id", String(id));
    await expect(sequence.locator("h2")).toHaveText(names[index]);
    await expect(canvas).toBeInViewport({ ratio: 0.9 });
  }
  await expect(home).not.toBeInViewport();
  await scrollIntro(intro, 0.065);
  await expect(sequence).toHaveAttribute("data-shoe-id", String(ids[0]));
  const upper = await canvas.screenshot();
  await scrollIntro(intro, 0.147);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const outsole = await canvas.screenshot();
  expect(outsole.equals(upper)).toBe(false);
  await scrollIntro(intro, 0.065);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect((await canvas.screenshot()).equals(upper)).toBe(true);

  await scrollIntro(intro, 1);
  await expect(sequence).toHaveAttribute("data-shoe-id", String(ids[3]));
  await expect(canvas).toBeInViewport({ ratio: 0.9 });
  await scrollIntro(intro, 1.29);
  await expect(home).toBeInViewport();

  await page.setViewportSize({ width: 1000, height: 700 });
  await scrollIntro(intro, 0.5);
  await expect(sequence).toHaveAttribute("data-shoe-id", String(ids[2]));
  await expect(canvas).toBeInViewport({ ratio: 0.9 });
  await page
    .getByRole("link", { name: "رفتن به صفحهٔ اصلی", exact: true })
    .click();
  await expect(page.locator("#home-content")).toBeFocused();
  await expect(home).toBeInViewport();
  await page
    .getByRole("link", { name: "ورود به کاتالوگ", exact: true })
    .click();
  await expect(page).toHaveURL(/\/shoes$/);
  await expect(canvas).toHaveCount(0);
  await page.goBack();
  await expect(intro).toHaveAttribute("data-renderer", "webgl");
  await expect(sequence).toHaveAttribute("data-shoe-id", String(ids[0]));
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("missing WebGL keeps four clear static photos, a working skip and product links", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (String(type).startsWith("webgl")) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/");
  const cards = page.locator(".intro-flow article");
  await expect(cards).toHaveCount(4);
  await expect(page.locator(".intro-canvas")).toHaveCount(0);
  for (const [i, card] of (await cards.all()).entries()) {
    const photo = card.getByRole("img", { name: names[i], exact: true });
    await photo.scrollIntoViewIfNeeded();
    await expect(photo).toHaveAttribute("alt", names[i]);
    await expect
      .poll(() => photo.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    expect(
      await photo.evaluate((el: HTMLImageElement) => {
        const canvas = document.createElement("canvas");
        canvas.width = el.naturalWidth;
        canvas.height = el.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(el, 0, 0);
        return ctx.getImageData(0, 0, 1, 1).data[3];
      }),
    ).toBe(0);
  }
  await page
    .getByRole("link", { name: "رفتن به صفحهٔ اصلی", exact: true })
    .click();
  await expect(page.locator("#home-title")).toBeInViewport();
});

test("context loss degrades safely to the native-flow photo sequence", async ({
  page,
}) => {
  await page.goto("/");
  const scene = page.locator(".shoe-intro");
  await expect(scene).toHaveAttribute("data-renderer", "webgl");
  await scene.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    canvas
      .getContext("webgl2")
      ?.getExtension("WEBGL_lose_context")
      ?.loseContext();
  });
  await expect(scene.locator(".intro-flow article")).toHaveCount(4);
  await expect(scene.locator("canvas")).toHaveCount(0);
});
