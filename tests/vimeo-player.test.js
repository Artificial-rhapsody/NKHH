import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createDevServer} from '../dev-server.js';

test('Vimeo detail immediately embeds an allowlisted responsive iframe',async()=>{
 const server=createDevServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:chromium.executablePath()});
 try{
  const page=await browser.newPage();
  await page.route('https://player.vimeo.com/**',r=>r.fulfill({contentType:'text/html',body:'<p>Player network fixture</p>'}));
  const record={id:'vimeo-test',title:'Vimeo interview',description:'Interview description',tags:['History'],cover:{src:'',alt:''}};
  const cases=[
   ['https://vimeo.com/reviews/26ef1eab-6cdc-4a15-97a4-8684a8cb9650/videos/1239174028','1239174028',null],
   ['https://vimeo.com/123456789','123456789',null],
   ['https://www.vimeo.com/123456789/abcdef1234','123456789','abcdef1234'],
   ['https://player.vimeo.com/video/123456789?h=abcdef1234&autoplay=1','123456789','abcdef1234']
  ];
  for(const [url,id,hash] of cases){
   await page.route('**/videos.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({videos:[{...record,url}]})}));
   await page.goto(`http://127.0.0.1:${server.address().port}/video.html?id=vimeo-test`);
   await page.waitForSelector('[data-video-ready=true]');
   const iframe=page.locator('#cover-stage iframe');assert.equal(await iframe.count(),1,url);
   const src=new URL(await iframe.getAttribute('src'));assert.equal(src.origin,'https://player.vimeo.com');assert.equal(src.pathname,'/video/'+id);assert.equal(src.searchParams.get('h'),hash);assert.notEqual(src.searchParams.get('autoplay'),'1');
   assert.equal(await iframe.getAttribute('title'),record.title);assert.notEqual(await iframe.getAttribute('allowfullscreen'),null);
   for(const width of [1440,390]){await page.setViewportSize({width,height:950});assert.equal(await iframe.isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
   await page.unroute('**/videos.json');
  }
  await page.route('**/videos.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({videos:[{...record,url:'https://vimeo.com.evil.example/123456789'}]})}));
  await page.goto(`http://127.0.0.1:${server.address().port}/video.html?id=vimeo-test`);await page.waitForSelector('[data-video-ready=true]');assert.equal(await page.locator('#cover-stage iframe').count(),0);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
