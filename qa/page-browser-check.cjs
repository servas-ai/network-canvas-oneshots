// SERVAS-2071 regression check of the shared page shell (shared/page.mjs) on
// all six functional surfaces over a bcli cloud session (CDP_URL) with a
// tunnel to the local server on :8874. Screenshots via CDP, never page.screenshot().
const { chromium } = require("playwright");
const fs = require("fs");
const DIR = "screenshots/page";
const PAGES = ["live", "tokscale", "tray", "usage", "opencodex", "cpa"];
(async () => {
  const browser = await chromium.connectOverCDP(process.env.CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.newPage());
  const client = await context.newCDPSession(page);
  fs.mkdirSync(DIR, { recursive: true });
  const out = {}, errors = [];
  page.on("pageerror", e => errors.push(`${page.url()}: ${e.message}`));
  const shot = async (name, width) => {
    const m = await client.send("Page.getLayoutMetrics");
    const s = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: Math.ceil(m.cssContentSize.height), scale: 1 } });
    fs.writeFileSync(`${DIR}/${name}.png`, Buffer.from(s.data, "base64"));
  };
  const ready = () => page.waitForSelector("#app[aria-busy=false] .ui-panel", { timeout: 90000 });
  const state = () => page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > innerWidth,
    panels: document.querySelectorAll("#app .ui-panel").length,
    errorPanel: [...document.querySelectorAll("#app h2")].some(h => h.textContent === "Daten nicht verfügbar"),
    refresh: document.getElementById("refresh").textContent,
    exportBtn: document.getElementById("export")?.textContent ?? null,
    live: document.getElementById("live").textContent,
    poll: document.getElementById("poll")?.textContent ?? null,
    theme: document.documentElement.dataset.theme,
    themeBtn: document.getElementById("theme").textContent }));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://localhost:8874/live/", { waitUntil: "networkidle", timeout: 30000 });
  await page.evaluate(() => localStorage.setItem("oneshots.theme", "dark"));
  for (const p of PAGES) {
    await page.goto(`http://localhost:8874/${p}/`, { waitUntil: "networkidle", timeout: 30000 }); await ready();
    const s = await state();
    const tabs = await page.$$("[role=tab]");
    if (tabs.length) {
      await tabs[0].focus(); await page.keyboard.press("ArrowLeft");
      s.arrowLeftWrapsTo = await page.evaluate(() => [document.activeElement.id, document.querySelector("#app").getAttribute("aria-labelledby"), document.querySelectorAll("#app .ui-panel").length]);
      await page.keyboard.press("Home");
    }
    if (s.exportBtn) {
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }).catch(() => null), page.keyboard.press("e")]);
      s.keyE = dl ? dl.suggestedFilename() : null;
    }
    await page.keyboard.press("r"); await page.waitForTimeout(50);
    s.keyRBusy = await page.evaluate(() => [document.getElementById("refresh").disabled, document.getElementById("refresh").textContent]);
    await ready();
    await shot(`${p}-dark-1280`, 1280);
    out[p] = s;
  }
  // theme persists across surfaces through the shared storage key
  await page.keyboard.press("t");
  await page.goto("http://localhost:8874/tray/", { waitUntil: "networkidle" }); await ready();
  out.themeAfterTOnCpaThenTray = await page.evaluate(() => document.documentElement.dataset.theme);
  // live: range change while a load is running must not be dropped (old bug)
  await page.goto("http://localhost:8874/live/", { waitUntil: "networkidle" }); await ready();
  const reqs = [];
  const onReq = r => { if (r.url().includes("/api/usage")) reqs.push(new URL(r.url()).search); };
  page.on("request", onReq);
  await page.click("#refresh");
  await page.selectOption("#range", "7");
  await page.waitForTimeout(200); await ready(); await page.waitForTimeout(1500); await ready();
  page.off("request", onReq);
  out.liveRangeDuringLoad = reqs;
  // cpa 30 days: coverage hint, light + narrow
  await page.goto("http://localhost:8874/cpa/", { waitUntil: "networkidle" }); await ready();
  await page.selectOption("#window", "30"); await page.waitForTimeout(300); await ready();
  out.cpaCoverageHint = await page.evaluate(() => [...document.querySelectorAll("#app .ui-empty[data-state=stale]")].map(e => e.textContent));
  await shot("cpa-30d-light-1280", 1280);
  await page.setViewportSize({ width: 420, height: 900 });
  for (const p of ["cpa", "usage"]) {
    await page.goto(`http://localhost:8874/${p}/`, { waitUntil: "networkidle" }); await ready();
    out[`${p}Narrow`] = await state(); await shot(`${p}-light-420`, 420);
  }
  out.pageErrors = errors;
  fs.writeFileSync(`${DIR}/browser-check.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
