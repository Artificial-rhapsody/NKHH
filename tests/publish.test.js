import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevServer } from '../dev-server.js';
test('local bridge forbids untrusted Origin and protects source files',async()=>{
 const server=createDevServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await fetch(base+'/workers/src/index.js')).status,404);
  assert.equal((await fetch(base+'/__local/publish',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/__local/content')).status,200);
 }finally{await new Promise(r=>server.close(r));}
});
