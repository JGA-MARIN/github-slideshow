import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const outDir = "/tmp/brygga-demo";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: false,
  args: ["--window-size=1280,900"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForSelector("text=Brygga");
await page.screenshot({ path: path.join(outDir, "01-home.png"), fullPage: true });

await page.getByRole("button", { name: "Vad har jag i kalendern de närmaste dagarna?" }).click();
await page.waitForSelector("text=Morgonstandup", { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, "02-calendar.png"), fullPage: true });

await page.fill("textarea", "Visa mina senaste mejl");
await page.getByRole("button", { name: "Skicka" }).click();
await page.waitForSelector("text=Lunch imorgon?", { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, "03-mail.png"), fullPage: true });

console.log(JSON.stringify({ ok: true, outDir, files: fs.readdirSync(outDir) }));
await browser.close();
