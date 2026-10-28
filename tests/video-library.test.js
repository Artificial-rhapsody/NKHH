import test from 'node:test';
import assert from 'node:assert/strict';
import {validateVideos} from '../video-validation.js';
const record=()=>({id:'interview-one',title:'Interview',url:'https://example.org/interview',description:'A description',tags:['Family','Migration'],cover:{src:'assets/temp/两个人.jpg',alt:'Cover'}});
test('video library validates empty library, required metadata, URL safety and unique IDs',()=>{
 assert.doesNotThrow(()=>validateVideos([]));assert.doesNotThrow(()=>validateVideos([record()]));
 for(const field of ['title','url','description']){const item=record();item[field]='';assert.throws(()=>validateVideos([item]));}
 const unsafe=record();unsafe.url='javascript:alert(1)';assert.throws(()=>validateVideos([unsafe]));
 assert.throws(()=>validateVideos([record(),record()]),/duplicate/);
 const bad=record();bad.cover.src='javascript:alert(1)';assert.throws(()=>validateVideos([bad]));
 const traversal=record();traversal.cover.src='../workers/src/index.js';assert.throws(()=>validateVideos([traversal]));
});
