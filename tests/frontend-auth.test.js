import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
test('temporary auth outage preserves token but does not trust cached role; retry restores session',async()=>{
 const dom=new JSDOM('<a href="#login">登录</a>',{url:'http://localhost:8000',runScripts:'outside-only'});
 const w=dom.window;const saved={token:'test-session',user:{id:'1',username:'tester',email:'test@example.invalid',role:'user'}};
 w.sessionStorage.setItem('story.session',JSON.stringify(saved));let available=false;
 w.fetch=async()=>new Response(JSON.stringify(available?{user:{...saved.user,role:'admin'}}:{error:'认证服务暂时不可用'}),{status:available?200:503});
 w.eval(await readFile(new URL('../response-utils.js',import.meta.url),'utf8'));
 w.eval(await readFile(new URL('../auth.js',import.meta.url),'utf8'));await w.SiteAuth.ready;
 assert.ok(w.sessionStorage.getItem('story.session'),'503 must not erase token');assert.equal(w.SiteAuth.getUser(),null,'cached role must remain untrusted');
 available=true;await w.SiteAuth.refresh();assert.equal(w.SiteAuth.getUser().role,'admin');dom.window.close();
});
test('confirmed expired session is removed',async()=>{
 const dom=new JSDOM('',{url:'http://localhost:8000',runScripts:'outside-only'});const w=dom.window;
 w.sessionStorage.setItem('story.session',JSON.stringify({token:'expired',user:{role:'admin'}}));
 w.fetch=async()=>new Response('{"error":"登录已失效"}',{status:401});
 w.eval(await readFile(new URL('../response-utils.js',import.meta.url),'utf8'));w.eval(await readFile(new URL('../auth.js',import.meta.url),'utf8'));await w.SiteAuth.ready;
 assert.equal(w.sessionStorage.getItem('story.session'),null);assert.equal(w.SiteAuth.getUser(),null);dom.window.close();
});
test('auth mounts login and registration forms, exports client',async()=>{
 const dom=new JSDOM('<a href="#login">登录</a>',{url:'http://localhost:8000',runScripts:'outside-only'});
 dom.window.APP_CONFIG={apiBase:''};dom.window.fetch=async()=>new Response('{"error":"请先登录"}',{status:401});
 dom.window.eval(await readFile(new URL('../response-utils.js',import.meta.url),'utf8'));
 dom.window.eval(await readFile(new URL('../auth.js',import.meta.url),'utf8'));
 await dom.window.SiteAuth.ready;
 assert.ok(dom.window.document.querySelector('#auth-dialog'));
 assert.equal(typeof dom.window.SiteAuth.request,'function');
 assert.ok(dom.window.document.querySelector('[name="confirmPassword"]'));
 dom.window.close();
});
