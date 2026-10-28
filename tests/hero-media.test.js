import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
test('hero supports uploaded video or muted looping Vimeo without losing image fallback',async()=>{
 const dom=new JSDOM(await readFile(new URL('../index.html',import.meta.url),'utf8'),{url:'http://localhost:8000/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 w.structuredClone=structuredClone;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}disconnect(){}};
 const site=JSON.parse(await readFile(new URL('../site.json',import.meta.url),'utf8'));w.fetch=async path=>({ok:true,text:async()=>JSON.stringify(path==='videos.json'?{videos:[]}:site)});
 for(const f of ['response-utils.js','script.js'])w.eval(await readFile(new URL('../'+f,import.meta.url),'utf8'));
 await new Promise(r=>setTimeout(r,30));
 const data=structuredClone(site);data.sections.hero.media={type:'video',src:'assets/uploads/site/videos/'+'a'.repeat(64)+'.mp4'};w.SitePage.render(data);
 const video=w.document.querySelector('.hero-image video');assert.ok(video);assert.equal(video.muted,true);assert.equal(video.loop,true);assert.equal(video.autoplay,true);assert.equal(video.playsInline,true);
 data.sections.hero.media={type:'vimeo',src:'https://vimeo.com/123456789/abcdef1234'};w.SitePage.render(data);const frame=w.document.querySelector('.hero-image iframe');assert.ok(frame);const src=new URL(frame.src);assert.equal(src.origin,'https://player.vimeo.com');for(const k of ['autoplay','muted','loop','background'])assert.equal(src.searchParams.get(k),'1');assert.equal(src.searchParams.get('h'),'abcdef1234');
 data.sections.hero.media.type='image';w.SitePage.render(data);assert.equal(w.document.querySelectorAll('.hero-image iframe,.hero-image video').length,0);assert.ok(w.document.querySelector('.hero-image img'));
 dom.window.close();
});
