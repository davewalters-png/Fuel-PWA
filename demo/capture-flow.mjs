/**
 * Drive YardFuel UI and capture detailed data-entry screenshots.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "captures-detail");
const BASE = process.env.YARDFUEL_URL || "http://127.0.0.1:8787/";

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved", file);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60000 });
  // Clear prior offline queue so screenshots show a single clean ticket
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase("keyval-store");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  });
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".brand", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, "01-home-status");

  async function fillInput(selector, value) {
    await page.focus(selector);
    await page.click(selector, { clickCount: 3 });
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.type(selector, value, { delay: 35 });
  }

  // Ensure record view
  const newTicket = await page.$("button.btn-primary");
  if (newTicket) await newTicket.click();
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, "02-new-ticket");

  // Search asset
  await page.click("#unit");
  await page.type("#unit", "TRK", { delay: 60 });
  await new Promise((r) => setTimeout(r, 700));
  await shot(page, "03-asset-search");

  // Select first unit result
  await page.waitForSelector(".unit-option", { timeout: 10000 });
  await page.click(".unit-option");
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, "04-asset-selected");

  // Update meters / context (replace prefilled meter entirely)
  await fillInput("#meter", "214900");
  await fillInput("#employee", "J. Ramirez");
  await fillInput("#location", "North Yard · Island 2");
  await shot(page, "05-meters-context");

  // Primary diesel qty + cost
  const qtyInputs = await page.$$(".line-row input");
  // First line: product select already DIESEL; fill qty and cost
  // Structure: product select, qty, unit cost per line
  const firstQty = await page.$(".product-group .line-row input[inputmode='decimal']");
  // More reliable: fill by label proximity via evaluating
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".product-group")[0].querySelectorAll(".line-row")];
    const inputs = rows[0].querySelectorAll("input");
    inputs[0].value = "";
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
  });
  // React controlled inputs need native setter
  async function setNative(selector, value) {
    await page.$eval(
      selector,
      (el, v) => {
        const proto = Object.getPrototypeOf(el);
        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        desc.set.call(el, v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      },
      value,
    );
  }

  // Fill first primary line qty/cost using ordered inputs in first product group
  const primaryInputs = await page.$$(".product-group:nth-of-type(1) .line-row input");
  // Actually DOM: product-groups > product-group (primary) > product-list > line-row
  const allLineInputs = await page.$$(".line-row input");
  // line 0: qty, unit cost (select is not input)
  if (allLineInputs[0]) {
    await allLineInputs[0].click({ clickCount: 3 });
    await allLineInputs[0].type("48.2", { delay: 50 });
  }
  if (allLineInputs[1]) {
    await allLineInputs[1].click({ clickCount: 3 });
    await allLineInputs[1].type("3.41", { delay: 50 });
  }
  await shot(page, "06-primary-diesel");

  async function setLastProduct(code, qty) {
    const addButtons = await page.$$("button.add-line");
    if (addButtons[1]) await addButtons[1].click();
    await new Promise((r) => setTimeout(r, 350));
    const selects = await page.$$(".line-row select");
    const lastSelect = selects[selects.length - 1];
    await lastSelect.select(code);
    await new Promise((r) => setTimeout(r, 200));
    const inputs = await page.$$(".line-row input");
    const qtyInput = inputs[inputs.length - 2];
    await qtyInput.click({ clickCount: 3 });
    await page.keyboard.press("Backspace");
    await qtyInput.type(String(qty), { delay: 40 });
  }

  await setLastProduct("DEF", "2.5");
  await shot(page, "07-def-line");

  await setLastProduct("OIL", "4");
  await shot(page, "08-oil-and-products");

  // Notes
  await page.click("#comments");
  await page.type("#comments", "Pump 3 · pre-trip top-off", { delay: 25 });
  // Scroll to show notes + submit
  await page.$eval("#comments", (el) => el.scrollIntoView({ block: "center" }));
  await new Promise((r) => setTimeout(r, 300));
  await shot(page, "09-notes-ready");

  // Scroll to submit
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 300));
  await shot(page, "10-submit-ready");

  // Submit and wait for synced status (exact class, not "syncing")
  await page.click("form .btn-primary");
  try {
    await page.waitForSelector(".badge.synced", { timeout: 20000 });
  } catch (err) {
    await shot(page, "11-queue-failed");
    const toast = await page.$eval(".toast", (el) => el.textContent).catch(() => "");
    const badges = await page.$$eval(".badge", (els) =>
      els.map((el) => el.textContent),
    );
    console.error("submit_debug", { toast, badges });
    throw err;
  }
  await new Promise((r) => setTimeout(r, 500));
  await shot(page, "11-queue-synced");

  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const item = document.querySelector(".queue-item");
    if (item) item.scrollIntoView({ block: "center" });
  });
  await shot(page, "12-queue-detail");

  await browser.close();
  console.log("done", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
