import { expect, test } from "@playwright/test";
test("national suggestions, settings compatibility, dynamic labels, small screen and dark mode", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByLabel("最寄り駅", { exact: true }).fill("鎌取");
  await expect(
    page.getByRole("button", { name: /鎌取.*東日本旅客鉄道/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /鎌取.*東日本旅客鉄道/ }).click();
  await page.getByLabel("目的地駅", { exact: true }).fill("水道橋");
  await expect(
    page.getByRole("button", { name: /水道橋/ }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /水道橋/ })
    .first()
    .click();
  await page.getByRole("button", { name: "保存してはじめる" }).click();
  await expect(page.getByRole("button", { name: /水道橋へ/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /鎌取へ/ })).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page
    .getByLabel("目的地駅", { exact: true })
    .fill("長い駅名".repeat(10));
  await page.getByRole("button", { name: "変更を保存" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("missing national data retains manual input and Yahoo departure/arrival order", async ({
  page,
  context,
}) => {
  await context.route("**/data/**", (r) => r.abort());
  await page.goto("./");
  await page.getByLabel("最寄り駅", { exact: true }).fill("鎌取");
  await page.getByLabel("目的地駅", { exact: true }).fill("水道橋");
  await page.getByRole("button", { name: "保存してはじめる" }).click();
  let external = "";
  await page.route("https://transit.yahoo.co.jp/**", (r) => {
    external = r.request().url();
    void r.fulfill({
      contentType: "text/html; charset=utf-8",
      body: "<h1>外部検索テスト</h1>",
    });
  });
  await page.getByRole("button", { name: /水道橋へ/ }).click();
  await page.waitForURL("https://transit.yahoo.co.jp/**");
  const params = new URL(external).searchParams;
  expect(params.get("from")).toBe("鎌取");
  expect(params.get("to")).toBe("水道橋");
  expect(params.get("s")).toBe("0");
  expect(params.get("type")).toBe("1");
});
test("real packages are saved and usable offline", async ({
  page,
  context,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-01T08:00:00+09:00"));
  await context.route("https://api-public.odpt.org/**", (r) => r.abort());
  await page.goto("./");
  await page.getByLabel("最寄り駅", { exact: true }).fill("西馬込");
  await page.getByRole("button", { name: /西馬込.*東京都/ }).click();
  await page.getByLabel("目的地駅", { exact: true }).fill("馬込");
  await page.getByRole("button", { name: /^馬込.*東京都/ }).click();
  await page.getByRole("button", { name: "保存してはじめる" }).click();
  await expect(
    page.getByText("利用する路線の時刻表を端末に保存しました。"),
  ).toBeVisible({ timeout: 30000 });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByText("利用する路線の時刻表を端末に保存しました。"),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole("button", { name: "最寄り → 目的地 馬込へ", exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  if (testInfo.project.name === "chromium")
    await page.reload();
  else
    testInfo.annotations.push({
      type: "limitation",
      description:
        "Playwright WebKit offline navigation encountered an internal error on Windows and Linux; checks offline IDB use without reloading. iPhone offline restart remains unverified.",
    });
  await expect(
    page.getByRole("button", { name: "最寄り → 目的地 馬込へ", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "最寄り → 目的地 馬込へ", exact: true })
    .click();
  await expect(page.getByLabel("経路候補")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("この経路で移動を開始")).toBeVisible();
  await page.getByText("この経路で移動を開始").click();
  await page.getByText("追跡を終了", { exact: true }).click();
  await context.setOffline(false);
});
test("legacy settings survive missing IndexedDB packages", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "quick-route.stations.v1",
      JSON.stringify({ nearby: "鎌取", destination: "水道橋" }),
    ),
  );
  await page.goto("./");
  await expect(page.getByRole("button", { name: /水道橋へ/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("quick-route.stations.v1")!).nearby,
    ),
  ).toBe("鎌取");
});
