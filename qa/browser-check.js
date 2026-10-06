(async()=>{
const names=['miro','figjam','lucidchart','whimsical','mural','opencodex','cpa-manager-plus','magpie','easycliproxy','cliproxy-quota-tray','cc-switch','9router','claude-code-router','cliproxyapi-usage','tokscale','index'];
const results=[];
for(const n of names){
 const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-2000px;top:0;width:1088px;height:818px;border:0';f.src='/'+n+'.html';document.body.append(f);await new Promise((ok,no)=>{f.onload=ok;f.onerror=no});
 const d=f.contentDocument,w=f.contentWindow,errors=[];
 if(d.documentElement.scrollWidth>1088+2)errors.push('horizontal overflow');
 if(!d.querySelector('svg'))errors.push('missing SVG');
 if(!d.querySelector('button'))errors.push('missing controls');
 if([...d.images].some(x=>x.complete&&!x.naturalWidth))errors.push('broken image');
 let checks=['render','no horizontal overflow','inline SVG'];
 const t=d.querySelector('[data-action=theme]');if(t){const v=d.body.classList.contains('dark');t.click();if(v===d.body.classList.contains('dark'))errors.push('theme failed');t.click();checks.push('theme toggle')}
 const sw=d.querySelectorAll('[data-action=switch]');if(sw.length>1){sw[1].click();if(!sw[1].closest('.account').classList.contains('active-account'))errors.push('activation failed');checks.push('provider activation')}
 if(n==='opencodex'){if(!sw[2].disabled)errors.push('cooldown is activatable');if(sw[1].closest('.account').querySelector('.badge').textContent!=='Routing')errors.push('stale Routing badge');checks.push('cooldown lockout','routing badge sync')}
 const tab=d.querySelector('[data-filter=codex]');if(tab){tab.click();if(d.querySelector('[data-group=codex]')?.hidden)errors.push('filter failed');checks.push('tool filter')}
 const note=d.querySelector('[data-action=add-note]');if(note){note.click();if(!d.querySelector('.new-note'))errors.push('note failed');checks.push('note creation')}
 const zoom=d.querySelector('[data-action=zoom-in]');if(zoom){zoom.click();if(d.querySelector('[data-zoom]').textContent==='100%')errors.push('zoom failed');checks.push('canvas zoom')}
 const sim=d.querySelector('[data-action=simulate]');if(sim){const sel=sim.closest('.panelbody').querySelector('select');sel.selectedIndex=2;sim.click();if(!d.querySelector('[data-simulation]').textContent.includes('Anthropic'))errors.push('primary routing failed');sel.selectedIndex=0;sim.click();if(!d.querySelector('[data-simulation]').textContent.includes('DeepSeek'))errors.push('fallback failed');checks.push('primary and fallback simulation')}
 if(n==='easycliproxy'){let copied=[];const cb=w.navigator.clipboard;const old=cb.writeText;cb.writeText=async x=>copied.push(x);d.querySelectorAll('[data-action=copy]').forEach(x=>x.click());await Promise.resolve();cb.writeText=old;if(copied.filter(x=>x==='http://127.0.0.1:8317').length!==2)errors.push('protocol-specific copy failed');checks.push('protocol endpoint copying')}
 if(['cpa-manager-plus','cliproxyapi-usage','tokscale'].includes(n)){const ex=w.demoMetrics;const expected=n==='cpa-manager-plus'?18420000:n==='cliproxyapi-usage'?9840000:284600000;if(ex.tokens!==expected||!ex.demo)errors.push('wrong export totals');checks.push('page-specific export totals')}
 results.push({file:n+'.html',width:1088,result:errors.length?'fail':'pass',checks,errors});f.remove();
}
return JSON.stringify(results);
})()
