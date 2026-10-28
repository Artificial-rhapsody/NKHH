import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';
async function setup(){
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');const site=JSON.parse(await readFile(new URL('../site.json',import.meta.url),'utf8'));
 const dom=new JSDOM(html,{url:'http://localhost:8000',runScripts:'outside-only'});const w=dom.window;
 w.structuredClone=structuredClone;w.fetch=async path=>new Response(JSON.stringify(String(path).includes('videos.json')?{videos:[]}:site));w.matchMedia=()=>({matches:false,addEventListener(){}});w.ResizeObserver=class{observe(){}disconnect(){}};
 w.eval(await readFile(new URL('../response-utils.js',import.meta.url),'utf8'));
 w.eval(await readFile(new URL('../script.js',import.meta.url),'utf8'));await new Promise(r=>setTimeout(r,10));return {dom,w,site};
}
test('homepage supports repeatable draft rendering without text or card duplication',async()=>{
 const {dom,w,site}=await setup();assert.ok(w.SitePage);site.sections.hero.title=['测试标题'];w.SitePage.render(site);w.SitePage.render(site);
 assert.equal(w.document.querySelector('h1').textContent,'测试标题');assert.equal(w.document.querySelectorAll('.rail-card').length,0);assert.equal(w.document.querySelector('#moments-empty').hidden,false);dom.window.close();
});
test('document title does not accumulate when rerendered',async()=>{
 const {dom,w,site}=await setup();site.meta.title='新页面标题';w.SitePage.render(site);w.SitePage.render(site);assert.equal(w.document.title,'新页面标题');dom.window.close();
});
