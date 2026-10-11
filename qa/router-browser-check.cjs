// SERVAS-2071 browser receipt for /router/ and the 7-link navigation, over a
// bcli cloud session (CDP_URL) with a tunnel to qa/router-fixture-server.mjs
// on :8874 (repo fixtures only). Asserts, not just logs: exits 1 on any
// failed check. SOURCE_SHA and FIXTURE_CCR are written into the JSON.
// Screenshots via CDP, never page.screenshot().
const { chromium } = require("playwright");
const fs = require("fs");
const DIR = "screenshots/router";
const PAGES = ["live", "tokscale", "tray", "usage", "opencodex", "cpa", "router"];
const CCR = process.env.FIXTURE_CCR ?? "config";
(async () => {
  const browser = await chromium.connectOverCDP(process.env.CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.newPage());
  const client = await context.newCDPSession(page);
  fs.mkdirSync(DIR, { recursive: true });
  const out = { sourceSha: process.env.SOURCE_SHA ?? null, fixtureCcr: CCR, checks: [], matrix: [] }, errors = [];
  const check = (name, ok, detail) => out.checks.push({ name, ok: Boolean(ok), detail });
  page.on("pageerror", e => errors.push(`${page.url()}: ${e.message}`));
  const shot = async name => {
    const m = await client.send("Page.getLayoutMetrics");
    const s = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: m.cssLayoutViewport.clientWidth, height: Math.ceil(m.cssContentSize.height), scale: 1 } });
    fs.writeFileSync(`${DIR}/${name}.png`, Buffer.from(s.data, "base64"));
  };
  const ready = () => page.waitForSelector("#app[aria-busy=false] .ui-panel", { timeout: 60000 });
  const layout = () => page.evaluate(() => {
    const inScroll = e => e.closest(".scroll, .ui-tabs, .ui-heatmap");
    const over = [...document.querySelectorAll("body *")].filter(e => !inScroll(e) && e.getBoundingClientRect().right > innerWidth + 0.5)
      .slice(0, 5).map(e => `${e.tagName.toLowerCase()}.${e.className}`);
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth, over,
      errorPanel: [...document.querySelectorAll("#app h2")].some(h => h.textContent === "Daten nicht verfügbar") };
  });

  const pages = CCR === "config" ? PAGES : ["router"];
  for (const theme of ["dark", "light"]) for (const width of [1280, 420]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://localhost:8874/router/", { waitUntil: "networkidle" });
    await page.evaluate(t => localStorage.setItem("oneshots.theme", t), theme);
    for (const p of pages) {
      await page.goto(`http://localhost:8874/${p}/`, { waitUntil: "networkidle" }); await ready();
      const l = await layout();
      out.matrix.push({ page: p, theme, width, ...l });
      check(`${p} ${theme} ${width}: no page overflow`, l.scrollWidth <= l.innerWidth && !l.over.length, l);
      check(`${p} ${theme} ${width}: no error panel`, !l.errorPanel);
      if (p === "router") await shot(`router-${CCR}-${theme}-${width}`);
    }
  }

  // router content, keyboard, export, nav
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://localhost:8874/router/", { waitUntil: "networkidle" }); await ready();
  const text = await page.evaluate(() => document.getElementById("app").innerText);
  out.routerText = text.slice(0, 4000);
  check("no secret or option text rendered", !/SECRET|OPTION-SHOULD|PROMPT-SHOULD|api_key|deepseek\.com/.test(text));
  check("router down shown as not reachable", /Kein Router auf 127\.0\.0\.1:345[67]/.test(text));
  if (CCR === "config") {
    check("rules from config", /deepseek-chat/.test(text) && /google\/gemini-2\.5-pro-preview/.test(text) && /deepseek-reasoner/.test(text));
    check("web search rule with URL rejected", /Nicht konfiguriert → default/.test(text));
    check("long context share 60 %", /\b60 %/.test(text));
    check("overlap shown as unknown", /Zuordnung unbekannt/.test(text));
    check("transformer names only", /openrouter, maxtoken/.test(text));
    check("timeout from config", /600[\s.\u00a0\u202f]?000 ms/.test(text));
  } else if (CCR === "none") {
    check("missing config explained", /config\.json fehlt/.test(text) && /CCR-Standard/.test(text));
  } else {
    check("broken config flagged", /Ungültiges JSON/.test(text));
  }
  check("nav has seven links, router current", await page.evaluate(() =>
    document.querySelectorAll(".ui-nav a").length === 7 && document.querySelector('.ui-nav a[aria-current="page"]').textContent === "Router"));
  const tabs = await page.$$("[role=tab]");
  await tabs[0].focus(); await page.keyboard.press("ArrowLeft");
  const wrap = await page.evaluate(() => [document.activeElement.id, document.getElementById("app").getAttribute("aria-labelledby")]);
  check("ArrowLeft wraps to last tab", wrap[0] === "tab-config" && wrap[1] === "tab-config", wrap);
  await page.keyboard.press("Home");
  check("Home returns to first tab", await page.evaluate(() => document.activeElement.id === "tab-all"));
  await page.keyboard.press("ArrowRight");
  const stream = await page.evaluate(() => [...document.querySelectorAll("#app tbody tr")].map(r => r.innerText.replace(/\s+/g, " ")));
  check("stream tab lists routed requests", stream.length === 5 && (CCR === "config"
    ? stream.filter(r => /Long context/.test(r)).length === 3 && stream.filter(r => /Background/.test(r)).length === 1
    : stream.every(r => /Default/.test(r))), stream);
  await page.keyboard.press("Home");
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }).catch(() => null), page.keyboard.press("e")]);
  check("e downloads router JSON", dl && /^claude-code-router-2026-10-10-1d\.json$/.test(dl.suggestedFilename()), dl?.suggestedFilename());
  await page.selectOption("#window", "30");
  await page.waitForResponse(r => r.url().includes("/api/usage?days=30"), { timeout: 30000 }).catch(() => null);
  await ready();
  check("30 day window loads", /30 Tage/.test(await page.evaluate(() => document.getElementById("app").innerText)));
  await page.keyboard.press("t");
  check("t toggles theme", await page.evaluate(() => document.documentElement.dataset.theme) === "dark");

  check("no page errors", errors.length === 0, errors);
  const failed = out.checks.filter(c => !c.ok);
  out.summary = { checks: out.checks.length, failed: failed.length };
  fs.writeFileSync(`${DIR}/browser-check-${CCR}.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ...out.summary, failed: failed.map(f => f.name) }));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
