"""E2E round 1 (design system + shortcuts) of the One-Shot Review overview, real Brave headless, temp profiles.

usage: python3 -I e2e_r1.py <base-url> <out-dir> [proof-prefix]
"""
import json, re, sys, pathlib, urllib.parse, urllib.request
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/') + '/'
OUT = pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
PREFIX = sys.argv[3] if len(sys.argv) > 3 else ''
BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
results = []
EMOJI = re.compile('[\U0001F300-\U0001FAFF☀-➿⬆⬇⭐⌚-⏿]')


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)


def shot(page, name):
    page.wait_for_timeout(350)  # let transitions settle
    page.screenshot(path=str(OUT / f'{PREFIX}{name}.png'))


def inner_w(page):
    return page.evaluate("document.getElementById('frame').contentWindow.innerWidth")


def tool(page):
    return urllib.parse.parse_qs(urllib.parse.urlparse(page.url).query).get('tool', [''])[0]


def frame_ready(page):
    page.wait_for_function("document.getElementById('frame').contentDocument?.readyState === 'complete'")
    page.wait_for_timeout(150)


def frame_to_page(page, sel):
    return page.evaluate("""(sel) => {
      const f = document.getElementById('frame');
      const el = f.contentDocument.querySelector(sel);
      const r = el.getBoundingClientRect();
      const o = document.getElementById('overlay').getBoundingClientRect();
      const s = o.width / f.contentWindow.innerWidth;
      return { x: o.left + (r.left + r.width / 2) * s, y: o.top + (r.top + r.height / 2) * s };
    }""", sel)


# ---- AC1: hex colors only inside the token blocks (static check of the served file)
html = urllib.request.urlopen(BASE + 'index.html').read().decode('utf8')
css = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
stripped = re.sub(r':root\s*\{.*?\n    \}', '', css, count=1, flags=re.S)
stripped = re.sub(r'@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{.*?\}\s*\}', '', stripped, count=1, flags=re.S)
stripped = re.sub(r':root\[data-theme="dark"\]\s*\{.*?\}', '', stripped, count=1, flags=re.S)
hexes = [h for h in re.findall(r'#[0-9A-Fa-f]{3,8}\b', stripped) if h.upper() not in ('#FF5F57', '#FEBC2E', '#28C840')]
rgba = re.findall(r'rgba?\(', stripped)
check('AC1 hex colors only in token blocks (+ traffic lights)', not hexes and not rgba, f'outside: {hexes[:5]} rgba={len(rgba)}')
tokens = {k: len(re.findall(rf'--{k}-[\w-]+:', css)) for k in ('sp', 'r', 'fs', 'shadow')}
check('AC1 spacing/radius/type/shadow tokens defined', all(v >= 3 for v in tokens.values()), str(tokens))

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=BRAVE, headless=True)
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=2, color_scheme='light')
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and errors.append(m.text))
    page.goto(BASE + 'index.html?tool=miro&geraet=iphone-390', wait_until='networkidle')
    frame_ready(page)

    # ---- AC3 navigation + device keys
    page.keyboard.press('n'); frame_ready(page)
    check('AC3 N -> next one-shot', tool(page) == 'figjam', tool(page))
    page.keyboard.press('p'); frame_ready(page)
    check('AC3 P -> previous one-shot', tool(page) == 'miro', tool(page))
    last = json.loads(urllib.request.urlopen(BASE + 'manifest.json').read())['items'][-1]['file'][:-5]
    page.keyboard.press('p'); frame_ready(page)
    check('AC3 P wraps to the last one-shot', tool(page) == last, f'{tool(page)} (last={last})')
    page.keyboard.press('n'); frame_ready(page)
    for key, want in [('2', 430), ('3', 820), ('4', 1440), ('1', 390)]:
        page.keyboard.press(key); page.wait_for_timeout(120)
        check(f'AC3 key {key} -> iframe width {want}', inner_w(page) == want, f'innerWidth={inner_w(page)}')
    page.keyboard.press('r'); page.wait_for_timeout(120)
    check('AC3 R -> landscape', inner_w(page) == 844 and 'quer=1' in page.url, f'innerWidth={inner_w(page)}')
    page.keyboard.press('r'); page.wait_for_timeout(120)

    # ---- AC3 search: /, typing does not trigger, Enter opens first hit, Esc clears
    page.keyboard.press('/')
    check('AC3 / focuses search', page.evaluate("document.activeElement.id") == 'search')
    page.keyboard.type('n1m')
    page.wait_for_timeout(150)
    check('AC3 typing "n1m" in search triggers nothing', tool(page) == 'miro' and inner_w(page) == 390 and page.get_attribute('#markBtn', 'aria-pressed') == 'false',
          f'tool={tool(page)} w={inner_w(page)} search={page.input_value("#search")!r}')
    page.keyboard.press('Escape')
    check('AC3 Esc clears search', page.input_value('#search') == '')
    page.keyboard.type('toks'); page.keyboard.press('Enter'); frame_ready(page)
    check('AC3 Enter opens first hit', tool(page) == 'tokscale', tool(page))
    page.fill('#search', ''); page.evaluate("document.getElementById('search').dispatchEvent(new Event('input'))")
    page.goto(BASE + 'index.html?tool=miro&geraet=iphone-390', wait_until='networkidle'); frame_ready(page)

    # ---- AC3 shortcuts with focus inside the prototype iframe
    def frame_pt(fx, fy):
        return page.evaluate("""([fx, fy]) => { const o = document.getElementById('overlay').getBoundingClientRect(), s = o.width / document.getElementById('frame').contentWindow.innerWidth; return { x: o.left + fx * s, y: o.top + fy * s }; }""", [fx, fy])
    blank = frame_pt(150, 660)
    page.mouse.click(blank['x'], blank['y'])
    in_frame = page.evaluate("document.activeElement === document.getElementById('frame')")
    page.keyboard.press('2'); page.wait_for_timeout(150)
    check('AC3 key 2 works with focus in iframe', in_frame and inner_w(page) == 430, f'focusInFrame={in_frame} innerWidth={inner_w(page)}')
    page.keyboard.press('1'); page.wait_for_timeout(150)
    sticky = frame_to_page(page, '.sticky-note.sticky-yellow .sticky-content')
    page.mouse.click(sticky['x'], sticky['y'])
    editable = page.evaluate("document.getElementById('frame').contentDocument.activeElement.isContentEditable")
    page.keyboard.press('4'); page.wait_for_timeout(150)
    check('AC3 typing in a contenteditable of the prototype triggers nothing', editable and inner_w(page) == 390, f'editable={editable} innerWidth={inner_w(page)}')
    page.reload(wait_until='networkidle'); frame_ready(page)
    page.mouse.click(blank['x'], blank['y'])

    # ---- AC3 M, marking, typing in the note dialog does not trigger
    page.keyboard.press('i'); page.wait_for_timeout(120)
    check('AC3 I without marks -> hint toast', 'Noch keine Markierung' in (page.text_content('#toast') or ''))
    page.keyboard.press('m')
    check('AC3 M -> mark mode on', page.get_attribute('#markBtn', 'aria-pressed') == 'true')
    pt = frame_to_page(page, '.sticky-note.sticky-yellow')
    page.mouse.move(pt['x'], pt['y']); page.wait_for_timeout(80)
    page.mouse.click(pt['x'], pt['y'])
    page.wait_for_selector('#noteDlg[open]')
    page.keyboard.type('n4 p Text zu klein')
    page.wait_for_timeout(100)
    check('AC3 typing in note dialog triggers nothing', tool(page) == 'miro' and inner_w(page) == 390)
    page.keyboard.press('Meta+Enter'); page.wait_for_timeout(200)
    check('AC3 Cmd+Enter saves note', not page.evaluate("document.getElementById('noteDlg').open") and page.locator('#marksList .card').count() == 1)
    a = page.evaluate("""() => { const o = document.getElementById('overlay').getBoundingClientRect(), s = o.width / document.getElementById('frame').contentWindow.innerWidth; return { x: o.left + 40 * s, y: o.top + 620 * s, x2: o.left + 300 * s, y2: o.top + 720 * s }; }""")
    page.mouse.move(a['x'], a['y']); page.mouse.down(); page.mouse.move(a['x2'], a['y2'], steps=6); page.mouse.up()
    page.wait_for_selector('#noteDlg[open]')
    page.fill('#noteText', 'Unterer Bereich: Leiste überdeckt Inhalt')
    page.click('#noteSave'); page.wait_for_timeout(150)
    page.keyboard.press('Escape')
    check('AC3 Esc ends mark mode', page.get_attribute('#markBtn', 'aria-pressed') == 'false')

    # ---- AC3 J/K select, I opens issue for the selection, card click selects
    page.evaluate("window.__opened = []; window.open = (u) => { window.__opened.push(u); return { opener: 1 }; }; 0")
    page.keyboard.press('j'); page.wait_for_timeout(150)
    sel1 = page.locator('#marksList .card.sel').count() == 1 and '#1' in page.text_content('#marksList .card.sel .nr')
    page.keyboard.press('j'); page.wait_for_timeout(150)
    sel2 = '#2' in page.text_content('#marksList .card.sel .nr')
    check('AC3 J steps through markings', sel1 and sel2)
    page.keyboard.press('k'); page.wait_for_timeout(150)
    check('AC3 K steps back', '#1' in page.text_content('#marksList .card.sel .nr'))
    page.keyboard.press('i'); page.wait_for_timeout(150)
    opened = page.evaluate('window.__opened')
    title = urllib.parse.parse_qs(urllib.parse.urlparse(opened[0]).query)['title'][0] if opened else ''
    check('AC3 I -> issue for selected marking', title.startswith('[Review] Miro #1'), title)
    page.locator('#marksList .card').nth(1).locator('.note').click(); page.wait_for_timeout(150)
    check('Card click selects marking', '#2' in page.text_content('#marksList .card.sel .nr') and page.locator('#overlay .mk.sel').count() == 1)
    page.keyboard.press('h'); page.wait_for_timeout(100)
    hidden = page.evaluate("getComputedStyle(document.querySelector('#overlay .mk')).display") == 'none'
    page.keyboard.press('h'); page.wait_for_timeout(100)
    check('AC3 H hides and shows markings', hidden and page.get_attribute('#showBtn', 'aria-pressed') == 'true')

    # ---- AC4 shortcut overview + tooltips
    page.keyboard.press('?'); page.wait_for_timeout(200)
    dlg_open = page.evaluate("document.getElementById('keysDlg').open")
    keys_text = page.text_content('#keysGrid')
    need = ['M', 'I', 'N', 'P', '1', '2', '3', '4', '/', 'T', '?', 'Esc', 'J', 'K', 'R', 'H']
    kb = page.eval_on_selector_all('#keysGrid .kbd', 'els => els.map(e => e.textContent)')
    check('AC4 ? opens overview with all keys', dlg_open and all(k in kb for k in need), f'missing={[k for k in need if k not in kb]}')
    shot(page, 'r1-tastenkuerzel-hell')
    page.keyboard.press('Escape'); page.wait_for_timeout(150)
    check('AC4 Esc closes overview', not page.evaluate("document.getElementById('keysDlg').open"))
    tips = page.evaluate("""() => [...document.querySelectorAll('[aria-keyshortcuts]')].filter(e => e.offsetParent).map(e => ({ k: e.getAttribute('aria-keyshortcuts'), tip: (e.dataset.tip || '') + ' ' + (e.getAttribute('aria-label') || '') }))""")
    bad = [t for t in tips if t['k'] not in t['tip'] and t['k'] != '/']
    check('AC4 every shortcut button names its key', len(tips) >= 10 and not bad, f'{len(tips)} buttons, bad={bad[:3]}')

    # ---- AC5 icons instead of emoji in controls
    ctl_text = page.evaluate("""() => [...document.querySelectorAll('header button, header a, .stage-bar button, .stage-bar a, aside button, dialog button, .hint')].map(e => e.textContent).join(' ')""")
    n_svg = page.evaluate("document.querySelectorAll('header svg.ic, .stage-bar svg.ic, aside svg.ic').length")
    check('AC5 controls use SVG icons, no emoji', not EMOJI.search(ctl_text) and n_svg >= 15, f'svg={n_svg} emoji={EMOJI.findall(ctl_text)[:5]}')

    # ---- AC2 theme: T cycles Auto -> Hell -> Dunkel, survives reload
    bg = lambda: page.evaluate("getComputedStyle(document.body).backgroundColor")
    start = page.evaluate("document.documentElement.dataset.theme || 'auto'")
    page.keyboard.press('t'); page.wait_for_timeout(100)
    t1 = page.evaluate("document.documentElement.dataset.theme || 'auto'")
    page.keyboard.press('t'); page.wait_for_timeout(100)
    t2 = page.evaluate("document.documentElement.dataset.theme || 'auto'")
    check('AC2 T: Auto -> Hell -> Dunkel', (start, t1, t2) == ('auto', 'light', 'dark'), f'{start} -> {t1} -> {t2} bg={bg()}')
    page.reload(wait_until='networkidle'); frame_ready(page)
    check('AC2 Dunkel survives reload', page.evaluate("document.documentElement.dataset.theme") == 'dark' and bg() == 'rgb(10, 11, 14)', bg())
    page.locator('#marksList .card').first.locator('.note').click(); page.wait_for_timeout(200)
    shot(page, 'r1-desktop-dunkel-markierungen')
    page.keyboard.press('?'); page.wait_for_timeout(200)
    shot(page, 'r1-tastenkuerzel-dunkel')
    page.keyboard.press('Escape')
    page.keyboard.press('m'); page.wait_for_timeout(100)
    c = page.evaluate("""() => { const o = document.getElementById('overlay').getBoundingClientRect(), s = o.width / document.getElementById('frame').contentWindow.innerWidth; return { x: o.left + 200 * s, y: o.top + 300 * s }; }""")
    page.mouse.click(c['x'], c['y']); page.wait_for_selector('#noteDlg[open]')
    page.fill('#noteText', 'Leere Fläche: hier fehlt ein Hinweis für neue Nutzer')
    shot(page, 'r1-notiz-dialog-dunkel')
    page.keyboard.press('Escape'); page.keyboard.press('Escape')
    page.keyboard.press('t'); page.wait_for_timeout(100)
    check('AC2 T wraps to Auto', page.evaluate("document.documentElement.dataset.theme || 'auto'") == 'auto')
    page.keyboard.press('t'); page.wait_for_timeout(250)
    page.locator('#marksList .card').first.locator('.note').click()
    shot(page, 'r1-desktop-hell-markierungen')
    check('No JS errors (desktop)', not errors, '; '.join(errors)[:200])
    ctx.close()

    # ---- AC2 Auto follows the system (dark), no stored choice
    ctxd = browser.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark')
    pd = ctxd.new_page()
    pd.goto(BASE + 'index.html?tool=opencodex&geraet=desktop', wait_until='networkidle')
    check('AC2 Auto follows system dark', pd.evaluate("getComputedStyle(document.body).backgroundColor") == 'rgb(10, 11, 14)' and not pd.evaluate("document.documentElement.dataset.theme"))
    ctxd.close()

    # ---- AC6 phone: no horizontal scroll, touch targets >= 36 px, light + dark
    for scheme in ('light', 'dark'):
        ctx3 = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True, color_scheme=scheme)
        p3 = ctx3.new_page()
        p3.goto(BASE + 'index.html?tool=figjam&geraet=iphone-390', wait_until='networkidle')
        p3.wait_for_timeout(400)
        sw = p3.evaluate('document.documentElement.scrollWidth')
        small = p3.evaluate("""() => [...document.querySelectorAll('header button, header select, .stage-bar button, .stage-bar a')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.textContent.trim().slice(0, 10), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(r => r.w < 36 || r.h < 36)""")
        check(f'AC6 phone {scheme}: no horizontal scroll, targets >= 36 px', sw <= 390 and not small, f'scrollWidth={sw} small={small[:4]}')
        if scheme == 'dark':
            p3.tap('#markBtn')
            o = p3.evaluate("(() => { const r = document.getElementById('overlay').getBoundingClientRect(); return { x: r.left + r.width * 0.45, y: r.top + r.height * 0.42 }; })()")
            p3.touchscreen.tap(o['x'], o['y'])
            p3.wait_for_selector('#noteDlg[open]')
            p3.fill('#noteText', 'Haftnotiz: Daumen-Zähler überdeckt den Text')
            p3.tap('#noteSave'); p3.wait_for_timeout(200)
            p3.tap('#markBtn'); p3.wait_for_timeout(3600)  # toast gone before the proof shot
        shot(p3, f'r1-mobil-390-{"hell" if scheme == "light" else "dunkel"}')
        if scheme == 'dark':
            p3.tap('#sheetBtn'); p3.wait_for_timeout(400)
            shot(p3, 'r1-mobil-390-dunkel-liste')
        ctx3.close()

    browser.close()

fails = [r for r in results if not r[1]]
print(f'\n{len(results) - len(fails)}/{len(results)} PASS')
(OUT / f'{PREFIX}r1-e2e-result.json').write_text(json.dumps([{'check': n, 'ok': o, 'detail': d} for n, o, d in results], ensure_ascii=False, indent=1))
sys.exit(1 if fails else 0)
