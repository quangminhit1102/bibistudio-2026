import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { isMain } from "./runtime.mjs";
export async function verifyRetainedAssets(assets, request = fetch) {
  for (const asset of assets) {
    const url = new URL(asset.url);
    url.searchParams.set("_bibi_probe", String(Date.now()));
    const response = await request(url, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok || !Buffer.from(await response.arrayBuffer()).equals(asset.bytes))
      throw new Error(`Retained old asset unavailable or changed: ${url.pathname}`);
  }
}
export async function captureOpenClient(baseUrl) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const response = await page.goto(baseUrl);
    if (!response?.ok()) throw new Error("Previous site must serve HTTP before activation");
    const urls = await page
      .locator('script[src],link[rel="stylesheet"][href]')
      .evaluateAll((elements) => elements.map((e) => e.src || e.href));
    const assets = [];
    for (const url of urls.filter((url) => new URL(url).origin === new URL(baseUrl).origin)) {
      const result = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!result.ok) throw new Error("Old client asset unavailable before deployment");
      assets.push({ url, bytes: Buffer.from(await result.arrayBuffer()) });
    }
    return {
      verify: async () => {
        await verifyRetainedAssets(assets);
        const about = page.getByRole("link", { name: "Về BiBi", exact: true }).first();
        if (await about.count()) {
          await about.click();
          await page.getByRole("heading", { level: 1 }).waitFor();
        }
        console.log(
          `Already-open client verified; ${assets.length} retained assets fetched without cache`,
        );
      },
      close: () => browser.close(),
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
export async function browserSmoke(baseUrl) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${baseUrl}/products/ca-phe-voi-nguoi-thuong-notebook`);
    await page.getByRole("heading", { name: "Cà Phê Với Người Thương", exact: true }).waitFor();
    const pictures = page.locator("main img");
    await pictures.first().waitFor();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("main img"))
        .filter((i) => i.getBoundingClientRect().top < innerHeight)
        .every((i) => i.complete && i.naturalWidth > 0),
    );
    await page.goto(`${baseUrl}/api-test`);
    await page
      .getByText("Kết nối thành công — phiên bản FE và BE khớp nhau.", { exact: true })
      .waitFor({ timeout: 30000 });
    if (errors.length) throw new Error(errors.join("\n"));
    await mkdir(".releases/evidence", { recursive: true });
    await page.screenshot({ path: ".releases/evidence/api-test.png", fullPage: true });
    console.log("Browser smoke passed: product images and API test");
  } finally {
    await browser.close();
  }
}
if (isMain(import.meta.url))
  browserSmoke(process.env.BASE_URL).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
