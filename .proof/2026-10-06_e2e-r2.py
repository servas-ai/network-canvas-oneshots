"""E2E round 2 (voice notes) of the One-Shot Review overview: real bridge, real whisper.cpp, synthetic speech
(macOS `say`) fed through a fake microphone into the page. Brave headless, temp profiles.

usage: python3 -I e2e_r2.py <base-url> <out-dir> <repo-dir> <wav-dir> [proof-prefix]
"""
import base64, json, subprocess, sys, time, pathlib, urllib.parse, urllib.request, urllib.error
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/') + '/'
OUT = pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
REPO = pathlib.Path(sys.argv[3])
WAV = pathlib.Path(sys.argv[4])
PREFIX = sys.argv[5] if len(sys.argv) > 5 else ''
BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
PORT = 9396
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True)


def shot(page, name, wait=300):
    page.wait_for_timeout(wait)
    page.screenshot(path=str(OUT / f'{PREFIX}{name}.png'))


def req(path, method='GET', headers=None, data=None):
    r = urllib.request.Request(f'http://127.0.0.1:{PORT}{path}', method=method, headers=headers or {}, data=data)
    try:
        with urllib.request.urlopen(r, timeout=60) as res:
            return res.status, res.read().decode(), dict(res.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(), dict(e.headers)


# ---- start a fresh bridge (new token)
bridge = subprocess.Popen(['node', str(REPO / 'scripts/voice-bridge.mjs'), '--port', str(PORT)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
first = json.loads(bridge.stdout.readline())
PAIR = first['pairing']; TOKEN = PAIR.split('.', 1)[1]
print('bridge', first['bridge'])

try:
    # ---- AC3 bridge rules
    st, body, _ = req('/health', headers={'Origin': 'https://evil.example'})
    check('AC3 foreign origin -> 403', st == 403, body)
    st, body, _ = req('/stt', 'POST', {'Origin': 'https://servas-ai.github.io', 'Content-Type': 'audio/wav'}, b'x' * 2000)
    check('AC3 no token -> 403 token_required', st == 403 and 'token_required' in body, body)
    st, body, _ = req('/health', headers={'Host': 'evil.example'})
    check('AC3 foreign Host (DNS rebinding) -> 403', st == 403 and 'host_rejected' in body, body)
    st, _, hd = req('/stt', 'OPTIONS', {'Origin': 'https://servas-ai.github.io', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Private-Network': 'true'})
    check('AC3 private-network preflight answered', st == 204 and hd.get('Access-Control-Allow-Private-Network') == 'true' and hd.get('Access-Control-Allow-Origin') == 'https://servas-ai.github.io', str(st))
    secrets = [l for l in (REPO / 'scripts/voice-bridge.mjs').read_text().splitlines() if 'TOKEN =' in l]
    check('AC3 token is random per start, not in code', len(secrets) == 1 and 'randomBytes' in secrets[0] and TOKEN not in (REPO / 'scripts/voice-bridge.mjs').read_text())

    # ---- AC4 real whisper.cpp through the bridge
    st, body, _ = req('/stt', 'POST', {'X-Voice-Token': TOKEN, 'Content-Type': 'audio/wav'}, (WAV / 's1.wav').read_bytes())
    text = json.loads(body).get('text', '') if st == 200 else body
    check('AC4 bridge -> whisper.cpp transcribes German speech', st == 200 and 'knopf' in text.lower() and 'klein' in text.lower(), text)

    # ---- AC7 Grok passthrough against the real harness (status only; no live session without Martin's go)
    st, body, _ = req('/grok/status', headers={'X-Voice-Token': TOKEN})
    g = json.loads(body) if st == 200 else {}
    check('AC7 Grok status passes through from 127.0.0.1:9381', st == 200 and g.get('provider') == 'grok' and 'consent' in g, f'{st} consent={g.get("consent")} login={g.get("login", {}).get("state")}')

    fake_mic = """
      window.__fakeWavB64 = %s;
      navigator.mediaDevices.getUserMedia = async () => {
        const ctx = new AudioContext();
        await ctx.resume();
        const bin = atob(window.__fakeWavB64), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        const audio = await ctx.decodeAudioData(buf.buffer);
        const src = ctx.createBufferSource(); src.buffer = audio;
        const dst = ctx.createMediaStreamDestination(); src.connect(dst); src.start();
        window.__fakeMicAt = performance.now();
        return dst.stream;
      };
    """ % json.dumps(base64.b64encode((WAV / 'zwei-saetze.wav').read_bytes()).decode())

    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=BRAVE, headless=True, args=['--autoplay-policy=no-user-gesture-required'])
        ORIGIN = urllib.parse.urlparse(BASE)._replace(path='', query='', fragment='').geturl()
        LNA = ['local-network-access'] if BASE.startswith('https://') else []
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=2, color_scheme='light')
        if LNA: ctx.grant_permissions(LNA, origin=ORIGIN)
        ctx.add_init_script(fake_mic)
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and errors.append(m.text))

        # ---- pairing via #voice=
        page.goto(BASE + f'index.html?tool=miro&geraet=iphone-390#voice={PAIR}', wait_until='networkidle')
        page.wait_for_function("document.getElementById('frame').contentDocument?.readyState === 'complete'")
        page.wait_for_timeout(800)
        cfg = page.evaluate("JSON.parse(localStorage.getItem('oneshots-review:voice') || '{}')")
        check('Pairing via #voice= stored, hash removed', cfg.get('token') == TOKEN and cfg.get('port') == PORT and '#voice' not in page.url, page.url[-60:])
        check('Pairing toast says paired', 'gekoppelt' in (page.text_content('#toast') or ''), page.text_content('#toast'))

        # settings dialog
        page.click('#voiceCfgBtn'); page.wait_for_timeout(900)
        adapters = page.eval_on_selector_all('#voiceAdapters input', 'els => els.map(e => e.value)')
        bridge_state = page.text_content('#bridgeBox .bridge-state')
        check('AC2 four adapters in the hook', adapters == ['whisper', 'grok', 'browser', 'tippen'], str(adapters))
        check('Settings show bridge connected', 'verbunden' in bridge_state, bridge_state)
        shot(page, 'r2-sprach-einstellungen')
        page.keyboard.press('Escape'); page.wait_for_timeout(200)

        def frame_center(sel):
            return page.evaluate("""(sel) => {
              const f = document.getElementById('frame'), el = f.contentDocument.querySelector(sel), r = el.getBoundingClientRect();
              const o = document.getElementById('overlay').getBoundingClientRect(), s = o.width / f.contentWindow.innerWidth;
              return { x: o.left + (r.left + r.width / 2) * s, y: o.top + (r.top + r.height / 2) * s, rect: [r.left, r.top, r.width, r.height].map(Math.round) };
            }""", sel)

        a = frame_center('.btn-share'); b = frame_center('#tool-sticky')
        page.mouse.move(a['x'] - 30, a['y'], steps=3); page.mouse.move(a['x'], a['y'], steps=3)
        page.wait_for_timeout(150)
        page.keyboard.press('v')
        page.wait_for_function('window.__fakeMicAt > 0', timeout=8000)
        hud = page.is_visible('#voiceHud')
        check('AC5 HUD visible while recording', hud and page.get_attribute('#voiceBtn', 'aria-pressed') == 'true')
        # wait until sentence 1 is being spoken, take the live shot
        page.wait_for_function("performance.now() - window.__fakeMicAt > 2600")
        bars = page.evaluate("Math.max(...[...document.querySelectorAll('#voiceVu i')].map(i => parseFloat(i.style.height) || 0))")
        live = page.text_content('#voiceState')
        check('AC5 level meter moves and state says listening', bars > 8 and 'Hört zu' in live, f'bar={bars}px state={live!r}')
        shot(page, 'r2-sprechen-live', wait=0)
        # move to element B during the pause (sentence 1 ends ~3.4 s, sentence 2 starts ~5.0 s)
        page.wait_for_function("performance.now() - window.__fakeMicAt > 4300")
        page.mouse.move(b['x'], b['y'], steps=6)
        page.wait_for_function("(JSON.parse(localStorage.getItem('oneshots-review:v1') || '{}').markierungen || []).length >= 2", timeout=20000)
        page.wait_for_timeout(400)
        shot(page, 'r2-zwei-sprach-notizen', wait=100)
        page.keyboard.press('v')
        page.wait_for_timeout(600)
        check('V stops the session', not page.is_visible('#voiceHud') and page.get_attribute('#voiceBtn', 'aria-pressed') == 'false')

        marks = page.evaluate("JSON.parse(localStorage.getItem('oneshots-review:v1') || '{}').markierungen || []")
        m1 = next((m for m in marks if 'btn-share' in (m.get('element') or {}).get('selector', '')), None)
        m2 = next((m for m in marks if 'tool-sticky' in (m.get('element') or {}).get('selector', '')), None)
        check('AC1 passage 1 -> marking on the element under the pointer (Share)', bool(m1) and 'knopf' in m1['notiz'].lower() and 'klein' in m1['notiz'].lower(), json.dumps(m1, ensure_ascii=False)[:200] if m1 else str([m.get('notiz') for m in marks]))
        check('AC1 pointer moved -> passage 2 on the new element (Sticky tool)', bool(m2) and 'berschrift' in m2['notiz'].lower(), m2['notiz'] if m2 else 'none')
        ok_rect = bool(m1) and abs(m1['x'] - a['rect'][0]) <= 1 and abs(m1['y'] - a['rect'][1]) <= 1 and abs(m1['breite'] - a['rect'][2]) <= 1
        check('AC1 coordinates = element rect at speaking time', ok_rect, f"mark={[m1[k] for k in ('x', 'y', 'breite', 'hoehe')] if m1 else None} el={a['rect']}")
        check('Marking records source + adapter', bool(m1) and m1.get('quelle') == 'sprache' and m1.get('adapter') == 'whisper')
        check('Card shows the voice chip', page.locator('#marksList .card', has_text='Sprache').count() == 2)
        page.evaluate("window.__opened = []; window.open = (u) => { window.__opened.push(u); return { opener: 1 }; }; 0")
        page.locator('#marksList .card', has_text='Knopf').locator('button', has_text='Issue erstellen').click()
        body = urllib.parse.parse_qs(urllib.parse.urlparse(page.evaluate('window.__opened[0]')).query)['body'][0]
        check('Issue body names the voice source', 'Sprach-Notiz (whisper)' in body and 'btn-share' in body)
        (OUT / f'{PREFIX}r2-issue-body.md').write_text(body, encoding='utf8')
        page.locator('#marksList .card', has_text='Knopf').locator('.note').click()
        shot(page, 'r2-sprach-notizen-liste')
        check('No JS errors (voice)', not errors, '; '.join(errors)[:200])

        # ---- hook API: a custom adapter
        n_before = len(marks)
        page.evaluate("""() => {
          window.OneshotsVoice.register({ id: 'test-stub', label: 'Test-Stub', desc: 'liefert festen Text',
            async start(cb) { setTimeout(() => { cb.onSpeechStart('t1'); cb.onPartial('t1', 'Stub …'); setTimeout(() => cb.onFinal('t1', 'Text vom eigenen Adapter'), 150); }, 50); },
            async stop() {} });
          const cfg = JSON.parse(localStorage.getItem('oneshots-review:voice')); cfg.adapter = 'test-stub'; localStorage.setItem('oneshots-review:voice', JSON.stringify(cfg));
        }""")
        page.reload(wait_until='networkidle'); page.wait_for_timeout(500)
        page.evaluate("""() => window.OneshotsVoice.register({ id: 'test-stub', label: 'Test-Stub', desc: 'liefert festen Text',
            async start(cb) { setTimeout(() => { cb.onSpeechStart('t1'); setTimeout(() => cb.onFinal('t1', 'Text vom eigenen Adapter'), 150); }, 50); }, async stop() {} })""")
        c = frame_center('.sticky-note.sticky-yellow')
        page.mouse.move(c['x'], c['y'], steps=3); page.wait_for_timeout(100)
        page.keyboard.press('v'); page.wait_for_timeout(700); page.keyboard.press('v'); page.wait_for_timeout(300)
        marks = page.evaluate("JSON.parse(localStorage.getItem('oneshots-review:v1') || '{}').markierungen || []")
        stub = [m for m in marks if m['notiz'] == 'Text vom eigenen Adapter']
        check('AC2 register(adapter) plugs in a custom STT', len(marks) == n_before + 1 and stub and stub[0]['adapter'] == 'test-stub' and 'sticky' in stub[0]['element']['selector'])

        # ---- Esc cancels a running session
        page.evaluate("""() => window.OneshotsVoice.register({ id: 'test-stub', label: 'Test-Stub', async start(cb) { setTimeout(() => cb.onSpeechStart('t9'), 50); }, async stop() {} })""")
        page.keyboard.press('v'); page.wait_for_timeout(300); page.keyboard.press('Escape'); page.wait_for_timeout(300)
        after = page.evaluate("(JSON.parse(localStorage.getItem('oneshots-review:v1') || '{}').markierungen || []).length")
        check('Esc cancels without saving the open passage', after == len(marks) and not page.is_visible('#voiceHud'))
        ctx.close()

        # ---- AC6 fallback without bridge + typing adapter
        ctx2 = browser.new_context(viewport={'width': 1440, 'height': 900})
        p2 = ctx2.new_page()
        p2.add_init_script("if (!localStorage.getItem('oneshots-review:voice')) localStorage.setItem('oneshots-review:voice', JSON.stringify({ adapter: 'whisper', port: 9399, token: 'x'.repeat(24) }))")
        p2.goto(BASE + 'index.html?tool=miro&geraet=iphone-390', wait_until='networkidle'); p2.wait_for_timeout(500)
        f = p2.evaluate("""() => { const fr = document.getElementById('frame'), el = fr.contentDocument.querySelector('.btn-share'), r = el.getBoundingClientRect(), o = document.getElementById('overlay').getBoundingClientRect(), s = o.width / fr.contentWindow.innerWidth; return { x: o.left + (r.left + r.width / 2) * s, y: o.top + (r.top + r.height / 2) * s }; }""")
        p2.mouse.move(f['x'], f['y'], steps=3); p2.wait_for_timeout(100)
        p2.keyboard.press('v'); p2.wait_for_timeout(3200)
        t = p2.text_content('#toast') or ''
        check('AC6 bridge offline / blocked -> clear message', ('node scripts/voice-bridge.mjs' in t or 'Lokales Netzwerk' in t) and not p2.is_visible('#voiceHud'), t)
        shot(p2, 'r2-bruecke-offline', wait=0)
        p2.evaluate("() => { const c = JSON.parse(localStorage.getItem('oneshots-review:voice')); c.adapter = 'tippen'; localStorage.setItem('oneshots-review:voice', JSON.stringify(c)); }")
        p2.reload(wait_until='networkidle'); p2.wait_for_timeout(500)
        p2.mouse.move(f['x'] - 5, f['y'], steps=3); p2.mouse.move(f['x'], f['y'], steps=2); p2.wait_for_timeout(100)
        p2.keyboard.press('v'); p2.wait_for_timeout(400)
        meta = p2.text_content('#noteMeta') if p2.evaluate("document.getElementById('noteDlg').open") else ''
        check('AC6 adapter "tippen" opens the note for the element under the pointer', 'btn-share' in meta, meta[:100])
        ctx2.close()

        # ---- phone: tap to set the spot (no hover)
        ctx3 = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True, color_scheme='dark')
        if LNA: ctx3.grant_permissions(LNA, origin=ORIGIN)
        ctx3.add_init_script(fake_mic)
        p3 = ctx3.new_page()
        p3.goto(BASE + f'index.html?tool=figjam&geraet=iphone-390#voice={PAIR}', wait_until='networkidle'); p3.wait_for_timeout(900)
        sw = p3.evaluate('document.documentElement.scrollWidth')
        over = p3.evaluate("""() => [...document.querySelectorAll('header *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 0.5 || r.left < -0.5); }).length""")
        check('Phone header with mic button fits 390 px', sw <= 390 and over == 0, f'scrollWidth={sw} outside={over}')
        p3.tap('#voiceBtn'); p3.wait_for_timeout(300)
        armed = p3.evaluate("document.body.classList.contains('voice-arm')")
        o = p3.evaluate("(() => { const r = document.getElementById('overlay').getBoundingClientRect(); return { x: r.left + r.width * 0.45, y: r.top + r.height * 0.42 }; })()")
        p3.touchscreen.tap(o['x'], o['y'])
        p3.wait_for_function("(JSON.parse(localStorage.getItem('oneshots-review:v1') || '{}').markierungen || []).length >= 1", timeout=20000)
        p3.wait_for_timeout(1500)
        shot(p3, 'r2-mobil-sprechen', wait=0)
        p3.tap('#voiceStop'); p3.wait_for_timeout(600)
        pm = p3.evaluate("JSON.parse(localStorage.getItem('oneshots-review:v1') || '{}').markierungen || []")
        check('Phone: tap arms, tap sets the spot, speech becomes a marking', armed and len(pm) >= 1 and 'knopf' in pm[0]['notiz'].lower(), f'armed={armed} notes={[m["notiz"] for m in pm]}')
        ctx3.close()
        browser.close()
finally:
    bridge.terminate()

fails = [r for r in results if not r[1]]
print(f'\n{len(results) - len(fails)}/{len(results)} PASS')
(OUT / f'{PREFIX}r2-e2e-result.json').write_text(json.dumps([{'check': n, 'ok': o, 'detail': d} for n, o, d in results], ensure_ascii=False, indent=1))
sys.exit(1 if fails else 0)
