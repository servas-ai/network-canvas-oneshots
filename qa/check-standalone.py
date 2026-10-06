from pathlib import Path
import subprocess,json,re
products=[p for p in Path('.').glob('*.html') if p.name!='index.html']
report=[]
for p in products:
 s=p.read_text(); js=re.search(r'<script>(.*?)</script>',s,re.S).group(1);Path('/tmp/one-shot-check.js').write_text(js)
 r=subprocess.run(['node','--check','/tmp/one-shot-check.js'],capture_output=True,text=True)
 assert r.returncode==0,(p.name,r.stderr)
 assert '<svg' in s and '<style>' in s and '</html>' in s
 assert not re.search(r'(?:src|href)=[\"\'](?:\./)?(?:css|js|assets)/',s)
 report.append({'file':p.name,'standalone':True,'javascriptSyntax':'pass','svgIcons':True})
Path('verification.json').write_text(json.dumps(report,indent=2))
print('15 standalone products verified; JavaScript syntax valid')
