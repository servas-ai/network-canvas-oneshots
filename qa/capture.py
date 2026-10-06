import subprocess,json,time
from pathlib import Path
names=['miro','figjam','lucidchart','whimsical','mural','opencodex','cpa-manager-plus','magpie','easycliproxy','cliproxy-quota-tray','cc-switch','9router','claude-code-router','cliproxyapi-usage','tokscale','index']
log=[]
for n in names:
 cmd=['opencli','browser','uqsbxvfe']
 r=subprocess.run(cmd+['open','http://localhost:8873/'+n+'.html'],capture_output=True,text=True)
 if r.returncode: raise RuntimeError(r.stderr+r.stdout)
 capture=cmd+['screenshot','screenshots/'+n+'.png','--width','1440','--height','1000']
 if n not in ['miro','figjam','lucidchart','whimsical','mural']:capture+=['--full-page']
 r=subprocess.run(capture,capture_output=True,text=True)
 if r.returncode:raise RuntimeError(r.stderr+r.stdout)
 print('Final capture '+n,flush=True)
 log.append({'tool':n,'command':' '.join(capture),'timestamp':time.strftime('%Y-%m-%dT%H:%M:%S%z')})
Path('screenshots/capture-log.json').write_text(json.dumps(log,indent=2))
