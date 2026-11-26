import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const credentialsPath = path.resolve(
  process.cwd(),
  "../.local/admin-access.json",
);
test.skip(
  !fs.existsSync(credentialsPath),
  "Requires a locally bootstrapped administrator; credentials never ship with tests.",
);

test("admin login, real visible impressions and unique outbound clicks", async ({
  page,
  browser,
}, info) => {
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  const denied = await page.request.get("/api/admin/analytics/stores");
  expect(denied.status()).toBe(401);
  const privateFile = await page.request.get(`/@fs${credentialsPath}`);
  expect(
    [403, 404].includes(privateFile.status()),
    "Private credentials must not be served by Vite",
  ).toBe(true);
  await page.goto("/admin");
  await page.getByLabel("نام کاربری").fill(credentials.username);
  await page.getByLabel("رمز عبور").fill(credentials.password);
  await page.getByRole("button", { name: "ورود به پنل" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  const session = await (await page.request.get("/api/admin/session")).json();
  const options = await (
    await page.request.get(
      "/api/shoes/adidas-adizero-evo-sl/offers?source=ShoeStoreLinks&sort=price_toman&page_size=6",
    )
  ).json();
  const target = options.items[0];
  const params = new URLSearchParams({
    q: "adidas Adizero EVO SL",
    retailer_id: target.retailer_id,
  });
  const endpoint = "/api/admin/analytics/stores?" + params;
  async function current() {
    return (await (await page.request.get(endpoint)).json()).items.find(
      (row: { shoe_id: number }) => row.shoe_id === 40586,
    );
  }
  const before = await current();
  const token = crypto.randomBytes(32).toString("base64url");
  const visitorHash = crypto.createHash("sha256").update(token).digest("hex");
  const cleanupPath = path.resolve(
    process.cwd(),
    "../.local/admin-e2e-visitors.json",
  );
  const cleanup = fs.existsSync(cleanupPath)
    ? JSON.parse(fs.readFileSync(cleanupPath, "utf8"))
    : [];
  fs.writeFileSync(cleanupPath, JSON.stringify([...cleanup, visitorHash]), {
    mode: 0o600,
  });
  const customer = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { DNT: "0" },
  });
  await customer.addCookies([
    {
      name: "rad_visitor",
      value: token,
      domain: "127.0.0.1",
      path: "/api",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await customer.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return ["127.0.0.1", "localhost"].includes(host)
      ? route.continue()
      : route.fulfill({
          contentType: "text/html",
          body: "<p>Outbound navigation test</p>",
        });
  });
  try {
    const shopper = await customer.newPage();
    await shopper.goto("http://127.0.0.1:5173/shoes/adidas-adizero-evo-sl");
    const first = shopper.locator(`[data-offer-key="${target.key}"]`);
    await first.scrollIntoViewIfNeeded();
    await expect
      .poll(async () => (await current()).viewers)
      .toBe(before.viewers + 1);
    const popup = shopper.waitForEvent("popup");
    await first.locator(".store-visit").click();
    await (await popup).close();
    await expect
      .poll(async () => (await current()).clickers)
      .toBe(before.clickers + 1);
    // Reloading the offer and reopening its gateway never creates another unique browser.
    await shopper.reload();
    await first.scrollIntoViewIfNeeded();
    const secondPopup = shopper.waitForEvent("popup");
    await first.locator(".store-visit").click();
    await (await secondPopup).close();
    expect((await current()).viewers).toBe(before.viewers + 1);
    expect((await current()).clickers).toBe(before.clickers + 1);
    const form = page.getByRole("form", { name: "فیلتر آمار" });
    await form
      .getByPlaceholder("نام کفش، برند یا فروشگاه")
      .fill("adidas Adizero EVO SL");
    await page
      .getByRole("combobox", { name: "فروشگاه", exact: true })
      .selectOption(target.retailer_id);
    await page.getByRole("button", { name: "اعمال فیلترها" }).click();
    await expect(
      page
        .getByRole("table")
        .getByRole("link", { name: "adidas Adizero EVO SL", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "به‌روزرسانی", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "به‌روزرسانی", exact: true }),
    ).toBeEnabled();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.resolve(
        process.cwd(),
        `../.local/admin-${info.project.name}.png`,
      ),
      fullPage: true,
    });
    const cookie = (await page.context().cookies()).find(
      (cookie) => cookie.name === "rad_admin_session",
    );
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Strict");
    await page.getByRole("button", { name: "خروج", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "ورود به پنل مدیریت" }),
    ).toBeVisible();
    expect((await page.request.get(endpoint)).status()).toBe(401);
    expect(session.csrf_token).toBeTruthy();
  } finally {
    await customer.close();
    await page.request.post("/api/admin/logout", {
      data: {},
      headers: { "X-CSRF-Token": session.csrf_token },
    });
  }
});
