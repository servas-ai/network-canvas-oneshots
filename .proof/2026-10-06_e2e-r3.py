"""E2E round 3 (V1/V2 version compare) of the One-Shot Review overview. Real premium V2 from GitHub (raw), Brave headless.

usage: python3 -I e2e_r3.py <base-url> <out-dir> [proof-prefix]
"""
import json, sys, pathlib, urllib.parse
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/') + '/'
OUT = pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
PREFIX = sys.argv[3] if len(sys.argv) > 3 else ''
BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)


def shot(page, name, wait=500):
    page.wait_for_timeout(wait)
    page.screenshot(path=str(OUT / f'{PREFIX}{name}.png'))


def frames(page):
    return page.evaluate("""() => [...document.querySelectorAll('#compare iframe')].map(f => ({ cls: f.className, srcdoc: !!f.getAttribute('srcdoc'), title: f.contentDocument?.title || '', w: f.contentWindow?.innerWidth || 0, text: (f.contentDocument?.body?.innerText || '').slice(0, 4000) }))""")


def wait_frames(page, n=2):
    page.wait_for_function(f"[...document.querySelectorAll('#compare iframe')].length === {n} && [...document.querySelectorAll('#compare iframe')].every(f => f.contentDocument?.readyState === 'complete' && f.contentDocument.body?.innerText.length > 50)", timeout=30000)
    page.wait_for_timeout(300)


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=BRAVE, headless=True)
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and errors.append(m.text))
    page.goto(BASE + 'index.html?tool=miro&geraet=iphone-390', wait_until='networkidle')
    page.wait_for_function("document.getElementById('frame').contentDocument?.readyState === 'complete'")

    # ---- AC1 + AC5: C opens side by side with the real premium V2
    page.keyboard.press('c')
    wait_frames(page)
    f = frames(page)
    check('AC1 C opens the compare view (Nebeneinander)', page.is_visible('#compare') and page.get_attribute('[data-mode="nebeneinander"]', 'aria-checked') == 'true')
    check('AC3 B loads via raw -> srcdoc (same origin, DOM readable)', f[1]['srcdoc'] and bool(f[1]['title']), f"A={f[0]['title']!r} B={f[1]['title']!r}")
    check('AC5 B is the real premium V2, different from A', f[0]['title'] != f[1]['title'] and 'Onboarding opportunities' in f[1]['text'], f"B title={f[1]['title']!r}")
    shot(page, 'r3-miro-nebeneinander')

    # device per side: B on Desktop
    page.select_option('.cside[data-side="b"] select', 'desktop')
    wait_frames(page)
    f = frames(page)
    check('AC4 device per side (A iPhone 390, B Desktop 1440)', f[0]['w'] == 390 and f[1]['w'] == 1440, f"A={f[0]['w']} B={f[1]['w']}")
    page.select_option('.cside[data-side="b"] select', 'iphone-390')
    wait_frames(page)

    # ---- slider: drag to 30 %, arrows
    page.click('[data-mode="schieber"]')
    wait_frames(page)
    knob = page.locator('.cmp-divider .knob').bounding_box()
    screen = page.evaluate("(() => { const r = document.querySelector('#compare .screen').getBoundingClientRect(); return { x: r.left, w: r.width, y: r.top + r.height / 2 }; })()")
    page.mouse.move(knob['x'] + knob['width'] / 2, knob['y'] + knob['height'] / 2)
    page.mouse.down(); page.mouse.move(screen['x'] + screen['w'] * 0.3, screen['y'], steps=8); page.mouse.up()
    cut = float(page.evaluate("getComputedStyle(document.getElementById('compare')).getPropertyValue('--cut')").strip().rstrip('%') or 0)
    clip = page.evaluate("getComputedStyle(document.querySelector('#compare .layer.b')).clipPath")
    check('AC1 slider drag to 30 % clips B', abs(cut - 30) < 2 and 'inset' in clip, f'cut={cut:.1f}% clip={clip}')
    page.keyboard.press('ArrowRight'); page.keyboard.press('ArrowRight')
    cut2 = float(page.evaluate("getComputedStyle(document.getElementById('compare')).getPropertyValue('--cut')").strip().rstrip('%') or 0)
    check('Slider moves with arrow keys', abs(cut2 - cut - 10) < 0.5, f'{cut:.1f} -> {cut2:.1f}')
    page.keyboard.press('ArrowLeft'); page.keyboard.press('ArrowLeft')
    shot(page, 'r3-miro-schieber')

    # ---- onion skin
    page.click('[data-mode="ueberblenden"]')
    wait_frames(page)
    page.fill('.cmp-range input', '70'); page.dispatch_event('.cmp-range input', 'input')
    op = page.evaluate("getComputedStyle(document.querySelector('#compare .layer.b')).opacity")
    check('AC1 Überblenden: B opacity follows the slider', abs(float(op) - 0.7) < 0.02, f'opacity={op}')
    shot(page, 'r3-miro-ueberblenden')

    # ---- AC6 compare issue names both versions
    page.evaluate("window.__opened = []; window.open = (u) => { window.__opened.push(u); return { opener: 1 }; }; 0")
    page.keyboard.press('i')
    q = urllib.parse.parse_qs(urllib.parse.urlparse(page.evaluate('window.__opened[0] || ""')).query)
    title, body = q.get('title', [''])[0], q.get('body', [''])[0]
    check('AC6 compare issue title names both versions', title == '[Review] Miro · Vergleich Aktuell (Pages) ↔ Premium (V2)', title)
    check('AC6 compare issue body: A, B with ref, share link', '**A:** Aktuell (Pages)' in body and '`feat/premium-oneshots`' in body and 'vergleich=feat%2Fpremium-oneshots' in body, body[:200])
    (OUT / f'{PREFIX}r3-vergleich-issue-body.md').write_text(f'# {title}\n\n{body}\n', encoding='utf8')

    # ---- AC3: mark on B, marking stores the version
    page.click('[data-mode="nebeneinander"]'); wait_frames(page)
    page.keyboard.press('m')  # M in compare = mark on B
    page.wait_for_function("document.getElementById('frame').contentDocument?.readyState === 'complete' && document.getElementById('frame').contentDocument.title.includes('Product preview')", timeout=30000)
    page.wait_for_timeout(400)
    vsel = page.evaluate("document.getElementById('versionSel').value")
    check('M in compare opens B in the main view in mark mode', vsel == 'feat/premium-oneshots' and page.get_attribute('#markBtn', 'aria-pressed') == 'true' and not page.is_visible('#compare'), f'version={vsel}')
    target = page.evaluate("""() => { const f = document.getElementById('frame'), d = f.contentDocument;
      const el = [...d.querySelectorAll('button')].find(b => /share/i.test(b.textContent)) || d.querySelector('button');
      const r = el.getBoundingClientRect(), o = document.getElementById('overlay').getBoundingClientRect(), s = o.width / f.contentWindow.innerWidth;
      return { x: o.left + (r.left + r.width / 2) * s, y: o.top + (r.top + r.height / 2) * s, text: el.textContent.trim() }; }""")
    page.mouse.move(target['x'], target['y']); page.wait_for_timeout(80); page.mouse.click(target['x'], target['y'])
    page.wait_for_selector('#noteDlg[open]')
    page.fill('#noteText', 'V2: Share-Knopf ist besser sichtbar, so lassen')
    page.click('#noteSave'); page.wait_for_timeout(200); page.keyboard.press('Escape')
    marks = page.evaluate("JSON.parse(localStorage.getItem('oneshots-review:v1') || '{}').markierungen || []")
    m = marks[-1] if marks else {}
    check('AC3 marking on V2 stores ref (+ sha when resolvable)', (m.get('version') or {}).get('ref') == 'feat/premium-oneshots' and 'button' in (m.get('element') or {}).get('selector', ''), json.dumps(m.get('version')))
    check('Card shows the version chip', page.locator('#marksList .card', has_text='Premium').count() == 1)
    shot(page, 'r3-markierung-auf-v2')
    page.locator('#marksList .card', has_text='Premium').locator('button', has_text='Issue erstellen').click()
    q = urllib.parse.parse_qs(urllib.parse.urlparse(page.evaluate('window.__opened.at(-1)')).query)
    check('AC6 marking issue names the version', '(Premium (V2))' in q['title'][0] and '**Version:** Premium (V2) (`feat/premium-oneshots`' in q['body'][0], q['title'][0])
    page.select_option('#versionSel', '')
    page.wait_for_function("!document.getElementById('frame').getAttribute('srcdoc') && document.getElementById('frame').contentDocument?.readyState === 'complete'")
    page.wait_for_timeout(300)
    check('Markings are per version (hidden on Aktuell)', page.locator('#overlay .mk').count() == 0)

    # ---- free ref: the premium lane's mac-sync commit
    page.keyboard.press('c'); wait_frames(page)
    page.select_option('select[aria-label="Version B"]', '__ref')
    page.fill('.compare-bar .cmp-ref', 'bf02f87'); page.keyboard.press('Enter')
    wait_frames(page)
    f = frames(page)
    check('AC2 free ref (commit bf02f87) loads as B', f[1]['srcdoc'] and 'bf02f87' in page.text_content('.cside[data-side="b"] .cside-head'), page.text_content('.cside[data-side="b"] .cside-head'))
    page.keyboard.press('Escape')

    # ---- AC5 CLI one-shot: OpenCodex, sync scroll
    page.goto(BASE + 'index.html?tool=opencodex&geraet=iphone-390&vergleich=feat/premium-oneshots&modus=nebeneinander', wait_until='networkidle')
    wait_frames(page)
    check('AC6 deep link ?vergleich=&modus= opens the compare view', page.is_visible('#compare') and page.get_attribute('[data-mode="nebeneinander"]', 'aria-checked') == 'true')
    f = frames(page)
    check('AC5 CLI one-shot (OpenCodex) V1 vs premium V2', f[1]['srcdoc'] and f[0]['title'] != f[1]['title'], f"A={f[0]['title']!r} B={f[1]['title']!r}")
    shot(page, 'r3-opencodex-nebeneinander')
    # scroll sync needs a one-shot that scrolls in both versions: 9router (V1 153 px, V2 1256 px at 390)
    page.goto(BASE + 'index.html?tool=9router&geraet=iphone-390&vergleich=feat/premium-oneshots&modus=nebeneinander', wait_until='networkidle')
    wait_frames(page)
    sy = page.evaluate("""() => { const [a, b] = [...document.querySelectorAll('#compare iframe')]; const max = Math.min(a.contentDocument.documentElement.scrollHeight - a.contentWindow.innerHeight, b.contentDocument.documentElement.scrollHeight - b.contentWindow.innerHeight); a.contentWindow.scrollTo(0, Math.min(120, max)); return Math.min(120, max); }""")
    page.wait_for_timeout(400)
    by = page.evaluate("document.querySelectorAll('#compare iframe')[1].contentWindow.scrollY")
    check('AC4 scroll sync: B follows A (9router)', sy > 0 and abs(by - sy) <= 1, f'A={sy} B={by}')
    page.click('.compare-bar button[aria-pressed]')
    page.evaluate("document.querySelectorAll('#compare iframe')[0].contentWindow.scrollTo(0, 0); 0"); page.wait_for_timeout(300)
    by2 = page.evaluate("document.querySelectorAll('#compare iframe')[1].contentWindow.scrollY")
    check('Scroll sync can be switched off', abs(by2 - by) <= 1, f'B stays {by2}')
    page.goto(BASE + 'index.html?tool=opencodex&geraet=iphone-390&vergleich=feat/premium-oneshots&modus=nebeneinander', wait_until='networkidle')
    wait_frames(page)
    page.keyboard.press('4'); wait_frames(page)
    f = frames(page)
    check('Keys 1-4 switch both sides', f[0]['w'] == 1440 and f[1]['w'] == 1440, f"A={f[0]['w']} B={f[1]['w']}")
    shot(page, 'r3-opencodex-desktop-nebeneinander')
    check('No JS errors', not errors, '; '.join(errors)[:200])
    ctx.close()

    # ---- phone: slider by default, fits 390
    ctx3 = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    p3 = ctx3.new_page()
    p3.goto(BASE + 'index.html?tool=figjam&geraet=iphone-390', wait_until='networkidle'); p3.wait_for_timeout(400)
    p3.tap('#compareBtn')
    wait_frames(p3)
    sw = p3.evaluate('document.documentElement.scrollWidth')
    check('Phone: compare opens as slider and fits 390 px', p3.get_attribute('[data-mode="schieber"]', 'aria-checked') == 'true' and sw <= 390, f'scrollWidth={sw}')
    shot(p3, 'r3-mobil-schieber')
    ctx3.close()
    browser.close()

fails = [r for r in results if not r[1]]
print(f'\n{len(results) - len(fails)}/{len(results)} PASS')
(OUT / f'{PREFIX}r3-e2e-result.json').write_text(json.dumps([{'check': n, 'ok': o, 'detail': d} for n, o, d in results], ensure_ascii=False, indent=1))
sys.exit(1 if fails else 0)
