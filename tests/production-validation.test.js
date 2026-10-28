import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../workers/src/index.js';
import {validateSite,validatePageEdit} from '../workers/src/site-validation.js';
import {validateVideos} from '../workers/src/video-validation.js';
const source=()=>readFile(new URL('../site.json',import.meta.url),'utf8').then(JSON.parse);
test('production schema accepts the current homepage and editable section headings',async()=>{
 const site=await source();assert.doesNotThrow(()=>validateSite(site));const draft=structuredClone(site);draft.sections.layouts.title='Updated moments';draft.sections.videos.title='Updated archive';assert.doesNotThrow(()=>validatePageEdit(draft,site));
});
test('production video schema accepts hashed uploaded covers',()=>{
 const video={id:'test',title:'Test',description:'Description',url:'https://vimeo.com/123',tags:[],cover:{src:'assets/uploads/videos/covers/'+'a'.repeat(64)+'.png',alt:'Cover'}};assert.doesNotThrow(()=>validateVideos([video]));
});
test('production homepage rejects credential URLs and invalid hero media',async()=>{
 const site=await source();site.sections.hero.action.href='https://user:password@example.org';assert.throws(()=>validateSite(site));site.sections.hero.action.href='#videos';site.sections.hero.media={type:'video',src:'https://example.org/file.mp4'};assert.throws(()=>validateSite(site));
});
test('invalid production video payload returns 400 rather than a server failure',async()=>{
 const env={DB:{prepare:()=>({bind:()=>({first:async()=>({id:'test',role:'admin'})})})}};
 const response=await worker.fetch(new Request('https://worker.example/api/videos',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+'a'.repeat(64)},body:JSON.stringify({videos:[{}],revision:'test'})}),env);assert.equal(response.status,400);
});
