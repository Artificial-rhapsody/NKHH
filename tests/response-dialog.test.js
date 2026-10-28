import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {chromium} from 'playwright';
import {createDevServer} from '../dev-server.js';
import http from 'node:http';
const root=new URL('../',import.meta.url);
test('auth proxy turns empty upstream responses into JSON 502',async()=>{
 const upstream=http.createServer((req,res)=>res.end());await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const server=createDevServer({workerBase:`http://127.0.0.1:${upstream.address().port}`});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/auth/me`);assert.equal(r.status,502);assert.match((await r.json()).error,/authentication service/);}
 finally{await new Promise(r=>server.close(r));await new Promise(r=>upstream.close(r));}
});
test('empty or HTML API responses produce actionable errors instead of JSON syntax errors',async()=>{
 const dom=new JSDOM('',{url:'http://localhost:8000',runScripts:'outside-only'});
 dom.window.eval(await readFile(new URL('response-utils.js',root),'utf8'));
 for(const response of [new Response('',{status:502}),new Response('<html>wrong server</html>',{status:404})]){
  await assert.rejects(dom.window.SiteResponses.readJson(response,'Authentication service'),error=>/authentication service/i.test(error.message)&&/HTTP/.test(error.message)&&!/Unexpected/.test(error.message));
 }
 assert.deepEqual(JSON.parse(JSON.stringify(await dom.window.SiteResponses.readJson(new Response('{"error":"请先登录"}',{status:401}),'Authentication service'))),{error:'请先登录'});
 dom.window.close();
});
test('dragging selection outside either dialog keeps it open; genuine backdrop click closes it',async()=>{
 const server=createDevServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:chromium.executablePath(),headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1200,height:950}});await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>document.documentElement.dataset.siteReady==='true');
 await page.locator('.nav-links a[href="#login"]').click();await page.locator('#auth-login [name="identifier"]').fill('selection@example.invalid');
 const input=await page.locator('#auth-login [name="identifier"]').boundingBox();
 await page.mouse.move(input.x+input.width-5,input.y+input.height/2);await page.mouse.down();await page.mouse.move(5,input.y+input.height/2,{steps:15});await page.mouse.up();
 assert.equal(await page.locator('#auth-dialog').evaluate(n=>n.open),true,'email selection must not close auth dialog');
 await page.mouse.click(5,5);assert.equal(await page.locator('#auth-dialog').evaluate(n=>n.open),false);

 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
