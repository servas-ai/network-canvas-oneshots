"""E2E check of the One-Shot Review overview (index.html) in real Brave (headless, temp profile).

usage: python3 -I e2e.py <base-url> <out-dir> [proof-prefix]
"""
import json, sys, urllib.parse, pathlib
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/') + '/'
OUT = pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
PREFIX = sys.argv[3] if len(sys.argv) > 3 else ''
BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)


def shot(page, name):
    p = OUT / f'{PREFIX}{name}.png'
    page.screenshot(path=str(p))
    return p


def frame_inner_width(page):
    return page.evaluate("document.getElementById('frame').contentWindow.innerWidth")


def frame_to_page(page, sel):
    """Center of an element inside the iframe, in page coordinates (stage is scaled)."""
    return page.evaluate("""(sel) => {
      const f = document.getElementById('frame');
      const el = f.contentDocument.querySelector(sel);
      const r = el.getBoundingClientRect();
      const o = document.getElementById('overlay').getBoundingClientRect();
      const s = o.width / f.contentWindow.innerWidth;
      return { x: o.left + (r.left + r.width / 2) * s, y: o.top + (r.top + r.height / 2) * s, s };
    }""", sel)


def overlay_point(page, fx, fy):
    return page.evaluate("""([fx, fy]) => {
      const f = document.getElementById('frame');
      const o = document.getElementById('overlay').getBoundingClientRect();
      const s = o.width / f.contentWindow.innerWidth;
      return { x: o.left + fx * s, y: o.top + fy * s };
    }""", [fx, fy])


def stored(page):
    return page.evaluate("JSON.parse(localStorage.getItem('oneshots-review:v1') || '{}').markierungen || []")


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=BRAVE, headless=True)
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=2, accept_downloads=True)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and errors.append(m.text))
    page.on('response', lambda r: r.status >= 400 and print(f'  note: HTTP {r.status} {r.url[:100]}'))

    page.goto(BASE + 'index.html?tool=miro', wait_until='networkidle')
    page.wait_for_function("document.getElementById('frame').contentDocument?.readyState === 'complete'")
    n_items = page.locator('nav.list .item').count()
    check('AC1 list shows 15 prototypes', n_items == 15, f'{n_items} items · {page.inner_text("#countLabel")}')
    cats = page.eval_on_selector_all('nav.list .group-title span:first-child', 'els => els.map(e => e.textContent)')
    check('AC1 grouped by category', cats[:2] == ['Canvas', 'CLI-Dashboard'], str(cats))

    # AC3 device widths
    for label, want in [('iPhone 390', 390), ('iPhone 430', 430), ('Tablet 820', 820), ('Desktop 1440', 1440)]:
        page.locator('#deviceSeg button', has_text=label).click()
        page.wait_for_timeout(150)
        got = frame_inner_width(page)
        check(f'AC3 {label} -> iframe innerWidth {want}', got == want, f'innerWidth={got}')
    page.locator('#deviceSeg button', has_text='iPhone 390').click()
    page.wait_for_timeout(200)
    check('AC3 phone frame class', 'phone' in page.get_attribute('#device', 'class'))
    shot(page, 'uebersicht-desktop-iphone390')

    # AC4 click = element marking
    page.keyboard.press('m')
    check('AC4 mark mode on via M', page.get_attribute('#markBtn', 'aria-pressed') == 'true')
    pt = frame_to_page(page, '.sticky-note.sticky-yellow')
    page.mouse.move(pt['x'], pt['y'])
    page.wait_for_timeout(100)
    page.mouse.click(pt['x'], pt['y'])
    page.wait_for_selector('#noteDlg[open]')
    page.fill('#noteText', 'Haftnotiz zu klein auf dem iPhone, Text abgeschnitten')
    page.click('#noteSave')
    page.wait_for_timeout(150)
    m = stored(page)
    check('AC4 element mark saved', len(m) == 1 and m[0]['art'] == 'element', json.dumps(m[0]['element'], ensure_ascii=False)[:160] if m else 'none')
    check('AC4 element anchor has selector + text', bool(m and 'sticky' in m[0]['element']['selector'] and m[0]['element']['text']))

    # AC4 drag = area marking
    a = overlay_point(page, 40, 600); b = overlay_point(page, 300, 720)
    page.mouse.move(a['x'], a['y']); page.mouse.down()
    page.mouse.move((a['x'] + b['x']) / 2, (a['y'] + b['y']) / 2, steps=5)
    page.mouse.move(b['x'], b['y'], steps=5); page.mouse.up()
    page.wait_for_selector('#noteDlg[open]')
    page.fill('#noteText', 'Unterer Bereich: Leiste überdeckt Inhalt')
    shot(page, 'markieren-notiz-dialog')
    page.click('#noteSave')
    page.wait_for_timeout(150)
    m = stored(page)
    area = [x for x in m if x['art'] == 'bereich']
    ok_rect = bool(area) and abs(area[0]['x'] - 40) <= 2 and abs(area[0]['y'] - 600) <= 2 and abs(area[0]['breite'] - 260) <= 3 and abs(area[0]['hoehe'] - 120) <= 3
    check('AC4 area mark rect in prototype px', ok_rect, json.dumps({k: area[0][k] for k in ('x', 'y', 'breite', 'hoehe')}) if area else 'none')

    # Cancel discards
    c = overlay_point(page, 200, 300)
    page.mouse.click(c['x'], c['y'])
    page.wait_for_selector('#noteDlg[open]')
    page.keyboard.press('Escape')
    page.wait_for_timeout(150)
    check('Spec cancel (Esc) discards draft', len(stored(page)) == 2)
    page.keyboard.press('Escape')  # leave mark mode
    check('Esc leaves mark mode', page.get_attribute('#markBtn', 'aria-pressed') == 'false')
    n_boxes = page.locator('#overlay .mk').count()
    check('AC4 overlay shows saved marks', n_boxes == 2, f'{n_boxes} boxes')
    shot(page, 'markierungen-overlay-liste')

    # AC5 reload keeps marks
    page.reload(wait_until='networkidle')
    page.wait_for_timeout(300)
    cards = page.locator('#marksList .card').count()
    check('AC5 reload keeps marks (list)', cards == 2, f'{cards} cards')
    check('AC5 URL keeps tool + device', 'tool=miro' in page.url and 'geraet=iphone-390' in page.url, page.url)

    # AC5 export JSON download
    with page.expect_download() as dl:
        page.click('#exportBtn')
    d = dl.value
    data = json.loads(pathlib.Path(d.path()).read_text())
    check('AC5 export JSON file', d.suggested_filename.startswith('oneshots-markierungen-') and data['schema'] == 'oneshots-review/markierungen@1' and len(data['markierungen']) == 2, d.suggested_filename)

    # AC6 issue link (capture window.open)
    page.evaluate("window.__opened = []; window.open = (u) => { window.__opened.push(u); return { opener: 1 }; }; 0")
    page.locator('#marksList .card').first.locator('button', has_text='Issue erstellen').click()
    url = page.evaluate('window.__opened[0]')
    q = urllib.parse.urlparse(url)
    params = urllib.parse.parse_qs(q.query)
    body = params.get('body', [''])[0]
    title = params.get('title', [''])[0]
    check('AC6 issue URL target', url.startswith('https://github.com/servas-ai/network-canvas-oneshots/issues/new?'), url[:90])
    check('AC6 title', title.startswith('[Review] Miro #1'), title)
    for needle in ['miro.html', 'iPhone 390', 'Koordinaten', 'sticky', 'Haftnotiz zu klein', '```json', 'Markierung in der Übersicht öffnen']:
        check(f'AC6 body contains {needle!r}', needle in body)
    check('AC6 URL length < 7000', len(url) < 7000, f'{len(url)} chars')
    (OUT / f'{PREFIX}issue-body.md').write_text(f'# {title}\n\n{body}\n', encoding='utf8')
    deep = next((l for l in body.split('\n') if 'Markierung in der Übersicht öffnen' in l), '')
    deep_url = deep[deep.index('](') + 2:-1] if '](' in deep else ''

    page.evaluate("window.__opened = []")
    page.click('#bundleBtn')
    bundle = page.evaluate('window.__opened[0]')
    bt = urllib.parse.parse_qs(urllib.parse.urlparse(bundle).query)['title'][0]
    check('AC6 bundle issue for tool', bt == '[Review] Miro · 2 Markierungen', bt)
    check('AC6 card shows issue opened', page.locator('#marksList .card.issued').count() == 2)

    check('No JS errors on page', not errors, '; '.join(errors)[:200])

    # Deep link from issue imports the mark into a fresh browser profile
    ctx2 = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
    p2 = ctx2.new_page()
    local_deep = deep_url.replace('https://servas-ai.github.io/network-canvas-oneshots/', BASE)
    p2.goto(local_deep, wait_until='networkidle')
    p2.wait_for_timeout(500)
    got = p2.evaluate("JSON.parse(localStorage.getItem('oneshots-review:v1') || '{}').markierungen || []")
    check('Deep link imports mark in fresh profile', len(got) == 1 and got[0]['notiz'].startswith('Haftnotiz'), local_deep[:100])
    check('Deep link: hash removed, mark visible', '#import' not in p2.url and p2.locator('#overlay .mk').count() == 1, p2.url[:100])
    ctx2.close()

    # AC2 API adds a file the manifest does not know (API mocked: this IP is rate-limited)
    ctx4 = browser.new_context(viewport={'width': 1440, 'height': 900})
    p4 = ctx4.new_page()
    p4.route('https://api.github.com/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'},
        body=json.dumps([{'name': n, 'type': 'file'} for n in ['index.html', 'gallery.html', 'miro.html', 'zz-probe.html', 'README.md']])))
    p4.route('**/zz-probe.html', lambda r: r.fulfill(status=200, content_type='text/html', body='<title>ZZ Probe — Testdatei</title><h1>Probe</h1>'))
    p4.goto(BASE + 'index.html', wait_until='networkidle')
    p4.wait_for_timeout(600)
    n4 = p4.locator('nav.list .item').count()
    neu = p4.locator('nav.list .item', has_text='ZZ Probe').count()
    check('AC2 API adds unknown .html as "Neu"', n4 == 16 and neu == 1 and 'Neu' in p4.text_content('nav.list'), f'{n4} items, probe={neu}')
    ctx4.close()
    ctx5 = browser.new_context(viewport={'width': 1440, 'height': 900})
    p5 = ctx5.new_page()
    p5.route('https://api.github.com/**', lambda r: r.fulfill(status=403, body='{"message":"API rate limit exceeded"}'))
    p5.goto(BASE + 'index.html', wait_until='networkidle')
    p5.wait_for_timeout(400)
    check('AC2 API 403 -> manifest list still complete', p5.locator('nav.list .item').count() == 15)
    ctx5.close()

    # AC7 phone-width overview
    ctx3 = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    p3 = ctx3.new_page()
    p3.goto(BASE + 'index.html?tool=figjam&geraet=iphone-390', wait_until='networkidle')
    p3.wait_for_timeout(400)
    sw = p3.evaluate('document.documentElement.scrollWidth')
    check('AC7 no horizontal scroll at 390', sw <= 390, f'scrollWidth={sw}')
    vis = {s: p3.locator(s).is_visible() for s in ['#pick', '#deviceSeg', '#markBtn', '#sheetBtn']}
    check('AC7 controls visible on phone', all(vis.values()), str(vis))
    over = p3.evaluate("""() => [...document.querySelectorAll('header *, .stage-bar *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 0.5 || r.left < -0.5); }).map(e => e.tagName + '.' + e.className + ':' + (e.textContent||'').trim().slice(0,12))""")
    check('AC7 nothing sticks out of the viewport', not over, str(over[:5]))
    shot(p3, 'mobil-390-uebersicht')
    # tap-to-mark on touch
    p3.tap('#markBtn')
    o = p3.evaluate("(() => { const r = document.getElementById('overlay').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.35 }; })()")
    p3.touchscreen.tap(o['x'], o['y'])
    p3.wait_for_selector('#noteDlg[open]')
    p3.fill('#noteText', 'Touch-Test auf dem iPhone')
    p3.tap('#noteSave')
    p3.wait_for_timeout(200)
    p3.tap('#sheetBtn')
    p3.wait_for_timeout(350)
    check('AC7 touch mark + sheet list', p3.locator('#marksList .card').count() == 1)
    shot(p3, 'mobil-390-markierungsliste')
    ctx3.close()

    browser.close()

fails = [r for r in results if not r[1]]
print(f'\n{len(results) - len(fails)}/{len(results)} PASS')
(OUT / f'{PREFIX}e2e-result.json').write_text(json.dumps([{'check': n, 'ok': o, 'detail': d} for n, o, d in results], ensure_ascii=False, indent=1))
sys.exit(1 if fails else 0)
