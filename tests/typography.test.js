import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createDevServer} from '../dev-server.js';
test('homepage uses readable Chinese system typography without symbol font',async()=>{
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/Galactico|data:font\//);
 assert.match(css,/--font:\s*system-ui/);
 const server=createDevServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
 try{
  const page=await browser.newPage();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}/`);
   await page.waitForFunction(()=>document.documentElement.dataset.siteReady==='true');
   const result=await page.evaluate(()=>({font:getComputedStyle(document.body).fontFamily,title:document.querySelector('h1').textContent,overflow:document.documentElement.scrollWidth>innerWidth}));
   assert.match(result.font,/system-ui/);assert.doesNotMatch(result.font,/Galactico/);assert.ok(result.title.includes('Korean Ethnic'));assert.equal(result.overflow,false,`page overflow at ${width}`);
  }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
