// SERVAS-2071 browser receipt for /switch/ and the 8-link navigation, over a
// bcli cloud session (CDP_URL) with a tunnel to qa/switch-fixture-server.mjs
// on :8874 (repo fixtures only). Asserts, not just logs: exits 1 on any
// failed check. SOURCE_SHA and FIXTURE_SWITCH are written into the JSON.
// Screenshots via CDP, never page.screenshot().
const { chromium } = require("playwright");
const fs = require("fs");
const DIR = "screenshots/switch";
const PAGES = ["live", "tokscale", "tray", "usage", "opencodex", "cpa", "router", "switch"];
const VARIANT = process.env.FIXTURE_SWITCH ?? "full";
const LEAK = /SENTINEL|SECRET|PROMPT-SHOULD|OPTION-SHOULD|SKILL-BODY|npx|\.invalid|DEEPSEEK_API_KEY|notify-send|Authorization|trust_level|\/home\//;
(async () => {
  const browser = await chromium.connectOverCDP(process.env.CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.newPage());
  const client = await context.newCDPSession(page);
  fs.mkdirSync(DIR, { recursive: true });
  const out = { sourceSha: process.env.SOURCE_SHA ?? null, fixtureSwitch: VARIANT, checks: [], matrix: [] }, errors = [];
  const check = (name, ok, detail) => out.checks.push({ name, ok: Boolean(ok), detail });
  page.on("pageerror", e => errors.push(`${page.url()}: ${e.message}`));
  const shot = async name => {
    const m = await client.send("Page.getLayoutMetrics");
    const s = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: m.cssLayoutViewport.clientWidth, height: Math.ceil(m.cssContentSize.height), scale: 1 } });
    fs.writeFileSync(`${DIR}/${name}.png`, Buffer.from(s.data, "base64"));
  };
  const ready = () => page.waitForSelector("#app[aria-busy=false] .ui-panel", { timeout: 60000 });
  const appText = () => page.evaluate(() => document.getElementById("app").innerText);
  const rows = () => page.evaluate(() => [...document.querySelectorAll("#app tbody tr")].map(r => r.innerText.replace(/\s+/g, " ")));
  const layout = () => page.evaluate(() => {
    const inScroll = e => e.closest(".scroll, .ui-tabs, .ui-heatmap");
    const over = [...document.querySelectorAll("body *")].filter(e => !inScroll(e) && e.getBoundingClientRect().right > innerWidth + 0.5)
      .slice(0, 5).map(e => `${e.tagName.toLowerCase()}.${e.className}`);
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth, over,
      errorPanel: [...document.querySelectorAll("#app h2")].some(h => h.textContent === "Daten nicht verfügbar") };
  });

  const pages = VARIANT === "full" ? PAGES : ["switch"];
  for (const theme of ["dark", "light"]) for (const width of [1280, 420]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://localhost:8874/switch/", { waitUntil: "networkidle" });
    await page.evaluate(t => localStorage.setItem("oneshots.theme", t), theme);
    for (const p of pages) {
      await page.goto(`http://localhost:8874/${p}/`, { waitUntil: "networkidle" }); await ready();
      const l = await layout();
      out.matrix.push({ page: p, theme, width, ...l });
      check(`${p} ${theme} ${width}: no page overflow`, l.scrollWidth <= l.innerWidth && !l.over.length, l);
      check(`${p} ${theme} ${width}: no error panel`, !l.errorPanel);
      if (p === "switch") await shot(`switch-${VARIANT}-${theme}-${width}`);
    }
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://localhost:8874/switch/", { waitUntil: "networkidle" }); await ready();
  const text = await appText();
  out.switchText = text.slice(0, 4000);
  check("read-only notice", /Umschalten nicht verfügbar/.test(text) && /Nur lesend/.test(text));
  if (VARIANT === "full") {
    check("claude via local CLIProxyAPI with link", /CLIProxyAPI/.test(text) && /localhost:8317/.test(text)
      && await page.evaluate(() => [...document.querySelectorAll("#app a.link")].some(a => a.getAttribute("href") === "../cpa/")));
    check("claude model and env credential", /claude-sonnet-4\.6/.test(text) && /opus: claude-opus-4\.6/.test(text) && /Umgebungsvariable · Wert nie gelesen/.test(text));
    check("codex deepseek, effort, custom provider without host", /DeepSeek/.test(text) && /api\.deepseek\.com/.test(text) && /Reasoning high/.test(text) && /Eigener Endpunkt/.test(text));
    check("codex quota not claimed for deepseek", /Codex-Quota gilt für die OpenAI-Anmeldung/.test(text));
    check("gemini model and login", /gemini-2\.5-pro/.test(text) && /Google-Anmeldung/.test(text));
    check("gemini last use unknown with reason", /Kein Session-Log-Collector/.test(text));
  } else if (VARIANT === "none") {
    check("three tools not installed", (text.match(/Nicht installiert/g) ?? []).length === 3 && (text.match(/nicht eingerichtet/g) ?? []).length === 3);
  } else {
    check("three configs invalid", (text.match(/Konfiguration ungültig/g) ?? []).length === 3 && (text.match(/lässt sich nicht lesen/g) ?? []).length === 3);
  }
  check("nav has eight links, switch current", await page.evaluate(() =>
    document.querySelectorAll(".ui-nav a").length === 8 && document.querySelector('.ui-nav a[aria-current="page"]').textContent === "Switch"));

  const tabs = await page.$$("[role=tab]");
  await tabs[0].focus(); await page.keyboard.press("ArrowLeft");
  const wrap = await page.evaluate(() => [document.activeElement.id, document.getElementById("app").getAttribute("aria-labelledby")]);
  check("ArrowLeft wraps to last tab", wrap[0] === "tab-files" && wrap[1] === "tab-files", wrap);
  const files = await rows(), filesText = await appText();
  check("files tab: prompts and backups", VARIANT === "full"
    ? files.length === 6 && /GEMINI\.md fehlt/.test(files.join("|")) && files.filter(r => /\.bak/.test(r)).length === 3
    : files.length === 3 && /Keine Backups gefunden/.test(filesText), files);
  if (VARIANT === "full") await shot("switch-full-tab-files");
  await page.keyboard.press("Home");
  check("Home returns to first tab", await page.evaluate(() => document.activeElement.id === "tab-providers"));
  await page.keyboard.press("ArrowRight");
  const mcp = await rows();
  check("mcp tab: names and transport only", VARIANT === "full"
    ? mcp.length === 6 && mcp.some(r => /docs http Claude Code/.test(r)) && mcp.some(r => /filesystem stdio Codex/.test(r))
    : mcp.length === 0, mcp);
  if (VARIANT === "full") await shot("switch-full-tab-mcp");
  await page.keyboard.press("ArrowRight");
  const skills = await rows();
  check("skills tab: matrix with unknown for missing folders", VARIANT === "full"
    ? skills.length === 3 && skills.every(r => /unbekannt$/.test(r)) && /review ✓ – unbekannt/.test(skills.join("|"))
    : skills.length === 0, skills);
  if (VARIANT === "full") await shot("switch-full-tab-skills");
  for (const tab of ["tab-mcp", "tab-skills", "tab-files", "tab-providers"]) {
    await page.click(`#${tab}`);
    check(`${tab}: no secret, URL or body rendered`, !LEAK.test(await appText()));
  }
  check("no secret, URL or body anywhere in the DOM", !LEAK.test(await page.evaluate(() => document.documentElement.outerHTML)));

  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }).catch(() => null), page.keyboard.press("e")]);
  check("e downloads switch JSON", dl && /^cc-switch-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl?.suggestedFilename());
  if (dl) { const p = await dl.path(); check("export carries no secret", p && !LEAK.test(fs.readFileSync(p, "utf8"))); }
  const [reload] = await Promise.all([page.waitForResponse(r => r.url().includes("/api/switch"), { timeout: 10000 }).catch(() => null), page.keyboard.press("r")]);
  check("r refetches /api/switch", Boolean(reload));
  await ready();
  await page.keyboard.press("t");
  check("t toggles theme", await page.evaluate(() => document.documentElement.dataset.theme) === "dark");
  if (VARIANT === "full") {
    await page.click("#app a.link");
    await page.waitForURL("**/cpa/", { timeout: 10000 }).catch(() => null);
    check("gateway link opens /cpa/", page.url().endsWith("/cpa/"), page.url());
  }

  check("no page errors", errors.length === 0, errors);
  const failed = out.checks.filter(c => !c.ok);
  out.summary = { checks: out.checks.length, failed: failed.length };
  fs.writeFileSync(`${DIR}/browser-check-${VARIANT}.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ...out.summary, failed: failed.map(f => f.name) }));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
