import { test, expect } from "@playwright/test";

const ids = [40586, 40390, 41349, 40830];
const names = [
  "adidas Adizero EVO SL",
  "Nike Pegasus 41",
  "ASICS Novablast 6",
  "Saucony Endorphin Speed 5",
];

test("four matching photographic 3D models and explicit skip stay available", async ({
  page,
}) => {
  const shaderErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /WebGL|shader/i.test(message.text()))
      shaderErrors.push(message.text());
  });
  await page.goto("/");
  const intro = page.locator(".shoe-intro");
  await expect(intro).toHaveAttribute("data-renderer", "photo-textured-3d");
  await expect(intro.locator("canvas")).toHaveCount(1);
  for (const [index, id] of ids.entries()) {
    await intro
      .getByRole("button", { name: `نمایش ${names[index]}`, exact: true })
      .click();
    await expect(intro.locator(".intro-live-chapter")).toHaveAttribute(
      "data-shoe-id",
      String(id),
    );
    await expect(intro.locator(".intro-product-info h2")).toHaveText(
      names[index],
    );
    const orbit = intro.locator(".intro-orbit");
    await expect(orbit).toHaveAttribute("data-ready", "true");
    await expect(
      orbit.getByRole("img", { name: `نمای سه‌بعدی ${names[index]}` }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        (slug) =>
          performance
            .getEntriesByType("resource")
            .some((entry) =>
              entry.name.endsWith(`/media/studio/${slug}/shoe.glb`),
            ),
        [
          "adidas-adizero-evo-sl",
          "nike-pegasus-41",
          "asics-novablast-6",
          "saucony-endorphin-speed-5",
        ][index],
      ),
    ).toBe(true);
  }
  expect(shaderErrors).toEqual([]);
  await expect(intro.locator(".intro-position")).toHaveText([
    "1",
    "2",
    "3",
    "4",
  ]);
  await intro
    .getByRole("link", { name: "رفتن به صفحهٔ اصلی", exact: true })
    .click();
  await expect(page.locator("#home-content")).toBeFocused();
  await expect(page.locator("#home-title")).toBeInViewport();
  await page
    .getByRole("link", { name: "ورود به کاتالوگ", exact: true })
    .click();
  await expect(page).toHaveURL(/\/shoes$/);
  await expect(intro).toHaveCount(0);
  await page.goBack();
  await expect(intro).toHaveAttribute("data-renderer", "photo-textured-3d");
  await expect(intro.locator(".intro-live-chapter")).toHaveAttribute(
    "data-active-index",
    "0",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("scroll distance drives the orbit, pauses at any angle and reverses through the handoff", async ({
  page,
}) => {
  await page.goto("/");
  const intro = page.locator(".shoe-intro");
  const chapter = intro.locator(".intro-live-chapter");
  const canvas = intro.locator("canvas");
  await expect(canvas).toBeVisible();
  const distance = (n: number) =>
    expect(intro).toHaveAttribute("data-distance", String(n));
  const wheel = async (dy: number, n: number) => {
    await page.mouse.wheel(0, dy);
    await distance(n);
  };
  const idle = async () => {
    const still = await canvas.screenshot();
    await page.waitForTimeout(400);
    expect((await canvas.screenshot()).equals(still)).toBe(true);
    return still;
  };
  await canvas.hover();
  const start = await idle();
  await wheel(6, 6);
  expect((await idle()).equals(start)).toBe(false);
  await wheel(-6, 0);
  expect((await idle()).equals(start)).toBe(true);
  await wheel(100, 100);
  await idle();
  await wheel(100, 200);
  await page.waitForTimeout(130);
  await wheel(60, 260);
  const halfway = await idle();
  await expect(chapter).toHaveAttribute("data-active-index", "0");
  await wheel(40, 300);
  await expect(chapter).toHaveAttribute("data-active-index", "1");
  await wheel(-40, 260);
  expect((await idle()).equals(halfway)).toBe(true);
  await intro
    .getByRole("button", { name: `نمایش ${names[3]}`, exact: true })
    .click();
  await wheel(5500, 1025);
  await idle();
  await wheel(5500, 1134);
  await expect(intro).toHaveAttribute("data-finished", "true");
  await page.waitForTimeout(150);
  await page.mouse.wheel(0, 750);
  await expect(page.locator("#home-title")).toBeInViewport();
});

test("touch tracks finger distance and reduced motion shows the static photos", async ({
  page,
}, info) => {
  await page.goto("/");
  const intro = page.locator(".shoe-intro");
  await expect(intro).toHaveAttribute("data-renderer", "photo-textured-3d");
  if (info.project.name !== "desktop") {
    const photo = intro.locator(".intro-visual");
    const { x, y, width, height } = (await photo.boundingBox())!;
    const touch = await page.context().newCDPSession(page);
    const swipe = (type: "touchStart" | "touchMove", offset: number) =>
      touch.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: [
          { x: Math.round(x + width / 2), y: Math.round(y + height - offset) },
        ],
      });
    await swipe("touchStart", 10);
    await swipe("touchMove", 90);
    await swipe("touchMove", 240);
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const travelled = Number(await intro.getAttribute("data-distance"));
    expect(travelled).toBeGreaterThan(80);
    expect(travelled).toBeLessThan(180);
    await page.waitForTimeout(400);
    expect(Number(await intro.getAttribute("data-distance"))).toBe(travelled);
    await expect(intro.locator(".intro-live-chapter")).toHaveAttribute(
      "data-active-index",
      "0",
    );
    expect(await page.evaluate(() => scrollY)).toBeLessThan(30);
    await touch.detach();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(intro).toHaveAttribute("data-renderer", "catalog-photo");
  await expect(page.locator(".intro-flow article")).toHaveCount(4);
  expect(
    await page
      .locator(".intro-flow img")
      .evaluateAll((nodes) =>
        nodes.every((node) =>
          node.getAttribute("src")?.startsWith("/media/studio/"),
        ),
      ),
  ).toBe(true);
  await intro
    .getByRole("link", { name: "رفتن به صفحهٔ اصلی", exact: true })
    .click();
  await expect(page.locator("#home-title")).toBeInViewport();
});

test("a missing model releases the gesture and keeps the four photographic posters", async ({
  page,
}) => {
  await page.route("**/media/studio/*/shoe.glb", (route) => route.abort());
  await page.goto("/");
  const intro = page.locator(".shoe-intro");
  await expect(intro).toHaveAttribute("data-renderer", "catalog-photo");
  await expect(intro.locator(".intro-flow img")).toHaveCount(4);
  await page.mouse.wheel(0, 750);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
});
