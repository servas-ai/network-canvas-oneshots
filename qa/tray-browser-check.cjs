// SERVAS-2071 Quota Tray browser check over a bcli cloud session (CDP_URL) with a
// tunnel to the local server on :8874. Screenshots via CDP, never page.screenshot().
const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const browser = await chromium.connectOverCDP(process.env.CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.newPage());
  const client = await context.newCDPSession(page);
  fs.mkdirSync("screenshots/tray", { recursive: true });
  const out = {};
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const shot = async (name, width) => {
    const m = await client.send("Page.getLayoutMetrics");
    const s = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: Math.ceil(m.cssContentSize.height), scale: 1 } });
    fs.writeFileSync(`screenshots/tray/${name}.png`, Buffer.from(s.data, "base64"));
  };
  const state = () => page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > innerWidth,
    subtitle: document.getElementById("subtitle").textContent,
    tab: document.querySelector("[role=tab][aria-selected=true]").textContent,
    panels: [...document.querySelectorAll("#app .ui-panel h2")].map(h => h.textContent),
    badges: [...document.querySelectorAll("#app .ui-badge")].map(b => b.dataset.state + ":" + b.textContent),
    meters: [...document.querySelectorAll("#app .ui-meter")].map(m => m.getAttribute("aria-valuetext")),
    poll: document.getElementById("poll").textContent, theme: document.documentElement.dataset.theme }));
  for (const [name, theme, width] of [["tray-dark", "dark", 1280], ["tray-light", "light", 1280], ["tray-narrow", "dark", 420]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://localhost:8874/tray", { waitUntil: "networkidle", timeout: 30000 });
    await page.evaluate(t => { localStorage.setItem("oneshots.theme", t); }, theme);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#app[aria-busy=false] .ui-panel", { timeout: 60000 });
    await shot(name, width);
    out[name] = await state();
  }
  // Keyboard: arrow keys move between provider tabs, r refreshes, t toggles theme.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.focus("#tab-all");
  await page.keyboard.press("ArrowRight");
  out.tabCodex = await state(); await shot("tray-tab-codex", 1280);
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  out.tabOther = await state(); await shot("tray-tab-other", 1280);
  out.focusAfterArrows = await page.evaluate(() => document.activeElement.id);
  await page.keyboard.press("End"); await page.keyboard.press("ArrowRight");
  out.wrapToFirst = await page.evaluate(() => document.activeElement.id);
  await page.keyboard.press("r"); await page.waitForSelector("#app[aria-busy=false]"); await page.waitForTimeout(300);
  out.keyR = await page.textContent("#live");
  await page.keyboard.press("t");
  out.keyT = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.click("nav.ui-nav a[href='../tokscale/']"); await page.waitForSelector("#app[aria-busy=false] .ui-heatmap-grid", { timeout: 60000 });
  out.navToTokscale = await page.evaluate(() => [location.pathname, document.querySelector("nav.ui-nav [aria-current=page]").textContent, document.querySelectorAll("nav.ui-nav a").length]);
  out.pageErrors = errors;
  fs.writeFileSync("screenshots/tray/browser-check.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
