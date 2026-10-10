const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const cdpUrl = process.env.CDP_URL;
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.newPage());
  await page.setViewportSize({ width: 1440, height: 1000 });
  const client = await context.newCDPSession(page);
  const out = {};
  for (const [name, theme] of [["usage-dark", "dark"], ["usage-light", "light"]]) {
    await page.goto("http://localhost:8874/", { waitUntil: "networkidle", timeout: 30000 });
    await page.evaluate(t => { localStorage.setItem("oneshots.theme", t); }, theme);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#app[aria-busy=false] .ui-metric", { timeout: 20000 });
    const m = await client.send("Page.getLayoutMetrics");
    const h = Math.ceil(m.cssContentSize.height);
    const shot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1440, height: h, scale: 1 } });
    fs.writeFileSync(`screenshots/live/${name}.png`, Buffer.from(shot.data, "base64"));
    out[name] = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth > innerWidth,
      badges: [...document.querySelectorAll(".ui-badge")].map(b => b.dataset.state + ":" + b.textContent),
      metrics: [...document.querySelectorAll(".ui-metric .value")].map(v => v.textContent),
      meters: [...document.querySelectorAll("[role=meter]")].map(m => m.getAttribute("aria-valuetext")),
      rows: document.querySelectorAll(".ui-table tbody tr").length, theme: document.documentElement.dataset.theme }));
  }
  // keyboard: refresh via Enter on focused native button, range change
  await page.focus("#refresh"); await page.keyboard.press("Enter");
  await page.waitForSelector("#app[aria-busy=false]");
  out.keyboardRefresh = await page.textContent("#live");
  await page.selectOption("#range", "1"); await page.waitForSelector("#app[aria-busy=false]"); await page.waitForTimeout(500);
  out.range1 = await page.evaluate(() => document.querySelectorAll(".ui-metric")[1].textContent);
  fs.writeFileSync("screenshots/live/browser-check.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
