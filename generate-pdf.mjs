import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, "guide.html");
const pdfPath = resolve(__dirname, "AI-Cost-Tracker-Guide.pdf");

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 794, height: 1123 });

await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 30000 });

// Wait for fonts AND PagedJS to finish paginating
await page.evaluateHandle("document.fonts.ready");
await page.waitForSelector(".pagedjs_pages", { timeout: 15000 });

// Small extra wait for PagedJS to finalize layout
await new Promise(r => setTimeout(r, 1000));

await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
});

await browser.close();
console.log(`PDF saved to: ${pdfPath}`);
