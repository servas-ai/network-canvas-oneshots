// SERVAS-2071 Tokscale browser check over a bcli cloud session (CDP_URL) with a
// tunnel to the local server on :8874. Screenshots via CDP, never page.screenshot().
const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const browser = await chromium.connectOverCDP(process.env.CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.newPage());
  const client = await context.newCDPSession(page);
  fs.mkdirSync("screenshots/tokscale", { recursive: true });
  const out = {};
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  for (const [name, theme, width] of [["tokscale-dark", "dark", 1440], ["tokscale-light", "light", 1440], ["tokscale-narrow", "dark", 760]]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("http://localhost:8874/tokscale", { waitUntil: "networkidle", timeout: 30000 });
    await page.evaluate(t => { localStorage.setItem("oneshots.theme", t); }, theme);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#app[aria-busy=false] .ui-heatmap-grid", { timeout: 60000 });
    const m = await client.send("Page.getLayoutMetrics");
    const shot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: Math.ceil(m.cssContentSize.height), scale: 1 } });
    fs.writeFileSync(`screenshots/tokscale/${name}.png`, Buffer.from(shot.data, "base64"));
    out[name] = await page.evaluate(() => ({
      url: location.pathname,
      overflowX: document.documentElement.scrollWidth > innerWidth,
      badges: [...document.querySelectorAll(".ui-badge")].map(b => b.dataset.state + ":" + b.textContent),
      metrics: [...document.querySelectorAll(".ui-metric .value")].map(v => v.textContent),
      title: document.querySelector(".ui-panel h2").textContent,
      gridFill: (() => { const g = document.querySelector(".ui-heatmap-grid"), h = document.querySelector(".ui-heatmap");
        return { gridW: Math.round(g.getBoundingClientRect().width), boxW: h.clientWidth, scrolledToNewest: h.scrollLeft + h.clientWidth >= h.scrollWidth - 1 }; })(),
      cells: document.querySelectorAll(".ui-heatmap-grid > span:not(.pad)").length,
      levels: [0, 1, 2, 3, 4].map(l => document.querySelectorAll(`.ui-heatmap-grid > span[data-level="${l}"]`).length),
      months: [...document.querySelectorAll(".ui-heatmap-months small")].map(s => s.textContent),
      modelRows: document.querySelectorAll(".ui-table tbody tr").length, theme: document.documentElement.dataset.theme }));
  }
  // Keyboard: 'r' refreshes, 'e' downloads JSON, 't' toggles theme; nav link reaches /live/.
  await page.keyboard.press("r"); await page.waitForSelector("#app[aria-busy=false]"); await page.waitForTimeout(300);
  out.keyR = await page.textContent("#live");
  const dl = page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
  await page.keyboard.press("e");
  const d = await dl;
  out.keyE = d ? d.suggestedFilename() : null;
  await page.keyboard.press("t");
  out.keyT = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.click("nav.ui-nav a[href='../live/']"); await page.waitForSelector("#app[aria-busy=false] .ui-metric", { timeout: 60000 });
  out.navToLive = await page.evaluate(() => [location.pathname, document.querySelector("nav.ui-nav [aria-current=page]").textContent]);
  out.pageErrors = errors;
  fs.writeFileSync("screenshots/tokscale/browser-check.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
