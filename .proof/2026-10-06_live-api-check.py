import json, sys, tempfile
from playwright.sync_api import sync_playwright
URL = 'https://servas-ai.github.io/network-canvas-oneshots/'
BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
api = []
with sync_playwright() as pw, tempfile.TemporaryDirectory() as prof:
    ctx = pw.chromium.launch_persistent_context(prof, executable_path=BRAVE, headless=True)
    page = ctx.new_page()
    page.on('response', lambda r: api.append((r.status, r.url)) if 'api.github.com' in r.url else None)
    page.goto(URL, wait_until='networkidle')
    page.wait_for_timeout(1500)
    res = page.evaluate("""() => ({
      items: document.querySelectorAll('nav.list [data-file]').length,
      groups: [...document.querySelectorAll('nav.list h3, nav.list .group-title')].map(e => e.textContent.trim()),
      cache: !!sessionStorage.getItem('oneshots-review:api'),
      count: document.querySelector('.brand')?.textContent.trim()
    })""")
    ctx.close()
print(json.dumps({'api': api, **res}, ensure_ascii=False, indent=1))
