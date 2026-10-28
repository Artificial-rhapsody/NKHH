import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createDevServer} from '../dev-server.js';
import {storeUpload} from '../upload-storage.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64');
test('authenticated uploads have immutable typed paths, safe serving and byte ranges',async()=>{
 const root=await mkdtemp(join(process.env.TMPDIR||tmpdir(),'keohh-upload-'));
 const worker=http.createServer((req,res)=>{res.writeHead(req.headers.authorization==='Bearer test-admin'?200:403,{'Content-Type':'application/json'});res.end('{}');});await new Promise(r=>worker.listen(0,'127.0.0.1',r));
 const server=createDevServer({workerBase:`http://127.0.0.1:${worker.address().port}`,uploadRoot:root});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const upload=(kind,body,type='image/png',extra={})=>fetch(base+'/__local/upload?kind='+kind,{method:'POST',headers:{Origin:base,Authorization:'Bearer test-admin','Content-Type':type,...extra},body});
 try{
  await assert.rejects(storeUpload({headers:{'content-type':'image/png','content-length':String(21*1024*1024)}},'site-image',root),e=>e.status===413);
  await assert.rejects(storeUpload({headers:{'content-type':'video/mp4','content-length':String(91*1024*1024)}},'hero-video',root),e=>e.status===413);
  assert.equal((await upload('site-image',png,'image/png',{Origin:'https://evil.example'})).status,403);
  assert.equal((await upload('site-image',png,'image/png',{Authorization:'Bearer ordinary'})).status,403);
  assert.equal((await upload('../evil',png)).status,400);
  assert.equal((await upload('site-image',Buffer.from('<html>not png</html>'))).status,400);
  assert.equal((await upload('site-image',png,'image/jpeg')).status,400);
  assert.equal((await upload('site-image',Buffer.from('<svg/>'),'image/svg+xml')).status,415);
  const response=await upload('site-image',png);assert.equal(response.status,201);const item=await response.json();assert.match(item.path,/^assets\/uploads\/site\/images\/[a-f0-9]{64}\.png$/);assert.deepEqual(await readFile(join(root,item.path.replace('assets/uploads/',''))),png);
  assert.equal((await (await upload('site-image',png)).json()).path,item.path);
  const get=await fetch(base+'/'+item.path);assert.equal(get.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await get.arrayBuffer()),png);
  assert.equal((await fetch(base+'/'+item.path,{method:'HEAD'})).headers.get('content-length'),String(png.length));
  const range=await fetch(base+'/'+item.path,{headers:{Range:'bytes=0-7'}});assert.equal(range.status,206);assert.deepEqual(Buffer.from(await range.arrayBuffer()),png.subarray(0,8));
  assert.equal((await fetch(base+'/'+item.path,{headers:{Range:'bytes=9999-'}})).status,416);
  const cover=await (await upload('video-cover',png)).json();assert.match(cover.path,/^assets\/uploads\/videos\/covers\//);
  const mp4=Buffer.from([0,0,0,24,...Buffer.from('ftypisom'),0,0,0,0,...Buffer.from('isommp42')]);const video=await upload('hero-video',mp4,'video/mp4');assert.equal(video.status,201);assert.match((await video.json()).path,/site\/videos\/[a-f0-9]{64}\.mp4$/);
  assert.equal((await upload('hero-video',png)).status,415);
 }finally{await new Promise(r=>server.close(r));await new Promise(r=>worker.close(r));await rm(root,{recursive:true,force:true});}
});
