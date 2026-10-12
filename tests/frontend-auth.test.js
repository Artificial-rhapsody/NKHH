import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
test('auth mounts login and registration forms, exports client',async()=>{
 const dom=new JSDOM('<a href="#login">登录</a>',{url:'http://localhost:8000',runScripts:'outside-only'});
 dom.window.APP_CONFIG={apiBase:''};dom.window.fetch=async()=>({ok:false,status:401,json:async()=>({error:'请先登录'})});
 dom.window.eval(await readFile(new URL('../auth.js',import.meta.url),'utf8'));
 await dom.window.SiteAuth.ready;
 assert.ok(dom.window.document.querySelector('#auth-dialog'));
 assert.equal(typeof dom.window.SiteAuth.request,'function');
 assert.ok(dom.window.document.querySelector('[name="confirmPassword"]'));
 dom.window.close();
});
