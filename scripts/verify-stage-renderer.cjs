const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright');
(async()=>{
 const session=JSON.parse(fs.readFileSync(process.env.BCLI_SESSION_FILE || '../browser-session.json'));
 const browser=await chromium.connectOverCDP(session.cdp_url || session.cdp_ws_url);
 const ctx=browser.contexts()[0];
 const page=await ctx.newPage();
 const root=process.cwd();
 await page.route('https://servas-ai.github.io/network-canvas-oneshots/**',async route=>{
   const u=new URL(route.request().url());
   const rel=decodeURIComponent(u.pathname.replace('/network-canvas-oneshots/',''))||'index.html';
   const file=path.join(root,rel);
   if(file.startsWith(root+'/') && fs.existsSync(file) && fs.statSync(file).isFile()) await route.fulfill({path:file,contentType:rel.endsWith('.js')?'application/javascript':rel.endsWith('.json')?'application/json':rel.endsWith('.html')?'text/html':undefined});
   else await route.abort();
 });
 await page.route('https://api.github.com/**',r=>r.fulfill({status:200,body:'[]',contentType:'application/json'}));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const assert=require('node:assert/strict');
 const results=[];
 await page.addInitScript(() => { if (typeof GPUAdapter !== 'undefined') { const request=GPUAdapter.prototype.requestDevice; GPUAdapter.prototype.requestDevice=async function(...args) { const d=await request.apply(this,args); window.testDevice=d; return d; }; } });
 const base='https://servas-ai.github.io/network-canvas-oneshots/?tool=miro&geraet=iphone-390';
 for(const forced of [false,true]){
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+(forced?'&renderer=canvas2d':''));
  await page.waitForFunction(()=>document.querySelector('#stage').dataset.renderer);
  await page.waitForFunction(()=>document.querySelector('#frame').contentDocument?.body?.children.length>0);
  await page.waitForTimeout(700);
  const result = await page.evaluate(()=>({backend:document.querySelector('#stage').dataset.renderer,canvas:{width:document.querySelector('.stage-renderer').width,height:document.querySelector('.stage-renderer').height},tool:document.querySelector('#toolName').textContent,iframePointerEvents:getComputedStyle(document.querySelector('#frame')).pointerEvents,canvasPointerEvents:getComputedStyle(document.querySelector('.stage-renderer')).pointerEvents,gpuAvailable:!!navigator.gpu})); result.forced=forced; results.push(result);
  assert.equal(result.tool,'Miro'); assert.equal(result.canvasPointerEvents,'none'); assert.ok(result.canvas.width>0);
  if(forced) assert.equal(result.backend,'canvas2d');
  await page.frameLocator('#frame').locator('body').click({position:{x:100,y:100}});
  assert.equal(await page.evaluate(()=>document.activeElement.id),'frame');

  await page.locator('#rotateBtn').click();
  await page.locator('#oneBtn').click();
  await page.locator('#oneBtn').click();
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});
  await page.waitForTimeout(100);
  const client=await ctx.newCDPSession(page);
  const shot=await client.send('Page.captureScreenshot',{format:'png'});
  fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/'+(forced?'fallback':'auto')+'.png',Buffer.from(shot.data,'base64'));
  await client.detach();
  if (!forced && result.backend === 'webgpu') { await page.evaluate(()=>window.testDevice.destroy()); await page.waitForFunction(()=>document.querySelector('#stage').dataset.renderer==='canvas2d'); results.push({case:'device-loss',backend:await page.locator('#stage').getAttribute('data-renderer')}); }
 }
 await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));
 await page.goto(base); await page.waitForFunction(()=>document.querySelector('#stage').dataset.renderer==='canvas2d'); results.push({case:'missing-webgpu',backend:await page.locator('#stage').getAttribute('data-renderer')});
 fs.writeFileSync('reports/webgpu-browser.json',JSON.stringify({results,errors},null,2));
 console.log(JSON.stringify({results,errors}));
 await page.close();await browser.close();
 assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e.message);process.exit(1)});
