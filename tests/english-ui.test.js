import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createDevServer} from '../dev-server.js';
test('English public UI has no upload CTA and thanks is one centered paragraph',async()=>{
 const server=createDevServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:chromium.executablePath()});
 try{const page=await browser.newPage();await page.route('**/videos.json',r=>r.fulfill({contentType:'application/json',body:'{"videos":[]}'}));await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>document.documentElement.dataset.siteReady==='true');
 assert.equal(await page.locator('#moments-empty').innerText(),'No videos yet.');assert.equal(await page.locator('#videos-empty').innerText(),'No videos yet.');assert.equal(await page.locator('main a[href="admin.html#upload"]').count(),0);
 assert.equal(await page.locator('.credits').count(),0);assert.equal(await page.locator('.thanks-copy').count(),1);assert.ok((await page.locator('.thanks-copy').innerText()).length>30);
 assert.equal(await page.locator('.thanks-copy').evaluate(n=>getComputedStyle(n).textAlign),'center');
 await page.locator('.nav-links a[href="#login"]').click();assert.doesNotMatch(await page.locator('body').innerText(),/\p{Script=Han}/u);assert.match(await page.locator('#auth-title').innerText(),/Log in/);
 await page.goto(`http://127.0.0.1:${server.address().port}/admin.html`);await page.waitForFunction(()=>window.SiteAuth!==undefined);assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.doesNotMatch(await page.locator('body').innerText(),/\p{Script=Han}/u);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
test('page configuration uses English copy but preserves local asset paths',async()=>{
 const site=JSON.parse(await readFile(new URL('../site.json',import.meta.url),'utf8'));
 function walk(v,path=''){if(typeof v==='string'){if(!path.endsWith('.src'))assert.doesNotMatch(v,/\p{Script=Han}/u,path);return;}for(const [k,item] of Object.entries(v))walk(item,path+'.'+k);}walk(site);assert.equal(typeof site.sections.thanks.description,'string');assert.equal(site.sections.thanks.names,undefined);
});
