#!/usr/bin/env python3
"""Add every one-shot .html in the repo root that manifest.json does not list yet.

Name comes from the file's <title> (text before the first dash), category "Neu".
Existing entries stay untouched. Run before committing new one-shots:

    python3 scripts/update-manifest.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'manifest.json'

data = json.loads(MANIFEST.read_text(encoding='utf8'))
known = {i['file'] for i in data['items']} | set(data.get('exclude', []))
added = []
for path in sorted(ROOT.glob('*.html')):
    if path.name in known:
        continue
    title = re.search(r'<title>(.*?)</title>', path.read_text(encoding='utf8'), re.S | re.I)
    name = re.split(r'\s[—–|-]\s', title.group(1).strip())[0] if title else path.stem
    data['items'].append({
        'file': path.name, 'name': name, 'category': 'Neu', 'form': '', 'description': '', 'tags': [],
        'screenshot': f'screenshots/{path.stem}.png',
    })
    added.append(path.name)

MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(f"{len(added)} neu: {', '.join(added) or '-'} · {len(data['items'])} im Manifest")
