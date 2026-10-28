import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';
test('Moments uses the library, switches next without navigating, rotates and resets timers',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),site=JSON.parse(await readFile(new URL('../site.json',import.meta.url),'utf8'));
 const videos=[1,2,3].map(n=>({id:'v'+n,title:'Interview '+n,url:'https://example.org/'+n,description:'Description '+n,tags:['Tag '+n],cover:{src:'assets/temp/两个人.jpg',alt:'Cover'}}));
 const dom=new JSDOM(html,{url:'http://localhost:8000',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;const timers=new Map();let serial=0;
 w.structuredClone=structuredClone;w.fetch=async path=>new Response(JSON.stringify(String(path).includes('videos.json')?{videos}:site));w.matchMedia=()=>({matches:false,addEventListener(){}});w.ResizeObserver=class{observe(){}disconnect(){}};w.setInterval=fn=>{timers.set(++serial,fn);return serial;};w.clearInterval=id=>timers.delete(id);
 w.eval(await readFile(new URL('../response-utils.js',import.meta.url),'utf8'));w.eval(await readFile(new URL('../script.js',import.meta.url),'utf8'));await new Promise(r=>setTimeout(r,20));
 assert.equal(w.document.querySelector('#moment-title').textContent,'Interview 1');assert.equal(w.document.querySelector('#moment-tags').textContent,'Tag 1');
 w.document.querySelector('#moment-next').click();assert.equal(w.document.querySelector('#moment-title').textContent,'Interview 2');assert.equal(w.location.pathname,'/');assert.ok(w.document.querySelector('#moment-link').href.endsWith('video.html?id=v2'));
 w.document.querySelector('#moments-content').matches=()=>false;w.document.activeElement.blur();[...timers.values()][0]();assert.equal(w.document.querySelector('#moment-title').textContent,'Interview 3');w.SitePage.render(site);assert.equal(timers.size,1);w.document.querySelector('#moment-pause').click();assert.equal(timers.size,0);dom.window.close();
});
