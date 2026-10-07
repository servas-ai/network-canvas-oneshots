const fs=require('fs');
const http=require('http');
const {chromium}=require('playwright');
(async()=>{
 const session=JSON.parse(fs.readFileSync(process.env.BCLI_SESSION_FILE || '../browser-session.json'));
 const browser=await chromium.connectOverCDP(session.cdp_url);
 const ctx=browser.contexts()[0];
 const root=require('path').resolve('dist');
 await ctx.route('https://servas-ai.github.io/network-canvas-oneshots/**',async r=>{
  const u=new URL(r.request().url()); const rel=decodeURIComponent(u.pathname.replace('/network-canvas-oneshots/',''))||'index.html';const file=require('path').join(root,rel);
  if(file.startsWith(root+'/')&&fs.existsSync(file)) await r.fulfill({path:file,contentType:rel.endsWith('.js')?'application/javascript':rel.endsWith('.json')?'application/json':rel.endsWith('.html')?'text/html':undefined});else await r.abort();
 });
 await ctx.route('https://api.github.com/**',r=>r.fulfill({body:'[]',contentType:'application/json'}));
 const versionURL=new URL(session.cdp_url);versionURL.pathname+='/json/version';
 const version=await (await fetch(versionURL)).json();
 const proxy=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({webSocketDebuggerUrl:version.webSocketDebuggerUrl}));});
 await new Promise(r=>proxy.listen(19358,'127.0.0.1',r));
 try {
 const {default:lighthouse}=await import('lighthouse');
 const result=await lighthouse('https://servas-ai.github.io/network-canvas-oneshots/?tool=miro&geraet=iphone-390',{port:19358,hostname:'127.0.0.1',output:['json','html'],onlyCategories:['performance','accessibility'],disableStorageReset:true});
 fs.writeFileSync('reports/lighthouse-mobile.json',result.report[0]);fs.writeFileSync('reports/lighthouse-mobile.html',result.report[1].split('\n').map(line=>line.trimEnd()).join('\n'));
 console.log(JSON.stringify({performance:result.lhr.categories.performance.score,accessibility:result.lhr.categories.accessibility.score,errors:result.lhr.runtimeError,failed:Object.values(result.lhr.audits).filter(a=>a.score!==null&&a.score<1).map(a=>({id:a.id,score:a.score,details:a.details}))}));
 } finally {proxy.close();await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1)});
