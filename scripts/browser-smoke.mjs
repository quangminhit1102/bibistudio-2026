import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { isMain } from "./runtime.mjs";
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
