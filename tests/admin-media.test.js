import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {spawnSync} from 'node:child_process';
import {createDevServer} from '../dev-server.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64');
test('admin selects obscured backgrounds, uploads images and hero videos, previews Vimeo and cover drafts',async()=>{
 const root=await mkdtemp(join(process.env.TMPDIR||tmpdir(),'keohh-admin-media-'));const original=await readFile(new URL('../site.json',import.meta.url),'utf8');
 const worker=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({user:{id:'test',username:'Admin',role:'admin',email:'test@example.invalid'}}));});await new Promise(r=>worker.listen(0,'127.0.0.1',r));
 const server=createDevServer({workerBase:`http://127.0.0.1:${worker.address().port}`,uploadRoot:root});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:chromium.executablePath()});
 try{
  const page=await browser.newPage();page.on('dialog',d=>d.accept());await page.addInitScript(()=>sessionStorage.setItem('story.session',JSON.stringify({token:'isolated-test-token',user:{username:'Admin',role:'admin'}})));
  await page.route('https://player.vimeo.com/**',r=>r.fulfill({contentType:'text/html',body:'Player fixture'}));
  await page.goto(base+'/admin.html');await page.waitForSelector('#admin-workspace:not([hidden])');const frame=page.frameLocator('#preview');
  for(const [button,path] of [['Hero media','sections.hero.image'],['Background image','sections.intro.backgroundImage'],['Image mask','sections.intro.maskImage'],['Image','sections.intro.image']]){
   await frame.getByRole('button',{name:button,exact:true}).click();const field=page.locator('#selected-fields .field').filter({has:page.locator('[data-path="'+path+'.src"]')});await field.locator('input[type=file]').setInputFiles({name:'test.png',mimeType:'image/png',buffer:png});
   await page.waitForFunction(p=>document.querySelector('#selected-fields [data-path="'+p+'.src"]').value.startsWith('assets/uploads/'),path);
   assert.match(await page.locator('#selected-fields [data-path="'+path+'.src"]').inputValue(),/^assets\/uploads\/site\/images\//);
  }
  await page.locator('#select-images').click();assert.equal(await page.locator('#selected-fields input[type=file]').count(),4);
  await page.locator('#select-hero').click();const media=page.locator('#selected-fields .field').filter({has:page.locator('[data-path="sections.hero.media.src"]')});const mp4=Buffer.from([0,0,0,24,...Buffer.from('ftypisom'),0,0,0,0,...Buffer.from('isommp42')]);await media.locator('input[type=file]').setInputFiles({name:'test.mp4',mimeType:'video/mp4',buffer:mp4});await page.waitForFunction(()=>document.querySelector('#preview').contentDocument.querySelector('.hero-image video'));
  assert.equal(await page.locator('#selected-fields [data-path="sections.hero.media.type"]').inputValue(),'video');
  const fixture=join(root,'playback-fixture.mp4');const generated=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=navy:s=160x90:r=10','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',fixture],{encoding:'utf8'});assert.equal(generated.status,0,generated.stderr);
  await media.locator('input[type=file]').setInputFiles({name:'real.mp4',mimeType:'video/mp4',buffer:await readFile(fixture)});
  await page.waitForFunction(()=>{const v=document.querySelector('#preview').contentDocument.querySelector('.hero-image video');return v&&v.readyState>=2&&!v.paused&&v.currentTime>0;});
  console.log('PASS real uploaded H.264 MP4 decoded and auto-playing muted in preview');
  await page.locator('#selected-fields [data-path="sections.hero.media.src"]').fill('https://vimeo.com/123456789');await page.locator('#selected-fields [data-path="sections.hero.media.type"]').selectOption('vimeo');await page.waitForFunction(()=>document.querySelector('#preview').contentDocument.querySelector('.hero-image iframe'));
  assert.match(await frame.locator('.hero-image iframe').getAttribute('src'),/background=1/);
  await page.locator('#reset-draft').click();await page.waitForFunction(()=>!document.querySelector('#preview').contentDocument.querySelector('.hero-motion'));
  await page.locator('[data-tab=upload]').click();await page.locator('#upload-panel input[type=file]').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:png});await page.waitForFunction(()=>document.querySelector('[name=cover]').value.startsWith('assets/uploads/videos/covers/'));assert.equal(await page.locator('#cover-preview').isVisible(),true);
  assert.equal(await readFile(new URL('../site.json',import.meta.url),'utf8'),original);
  console.log('PASS actual HTTP uploads, all image controls, hero Vimeo/video drafts, cover upload, reset; published source untouched');
 }finally{await browser.close();await new Promise(r=>server.close(r));await new Promise(r=>worker.close(r));await rm(root,{recursive:true,force:true});}
});
