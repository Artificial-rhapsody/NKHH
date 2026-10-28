import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,access,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
test('Pages artifact contains public files and assets without backend sources',async()=>{
 const {buildStatic}=await import('../build-static.js');const root=await mkdtemp(join(process.env.TMPDIR||tmpdir(),'keohh-build-'));
 try{const out=join(root,'site');await buildStatic(out);for(const path of ['index.html','site.json','videos.json','media-upload.js','.nojekyll','assets/images/intro-mask.png'])await access(join(out,path));for(const path of ['workers','node_modules','dev-server.js','upload-storage.js','package.json','.env'])await assert.rejects(access(join(out,path)));assert.match(await readFile(join(out,'index.html'),'utf8'),/script.js/);}
 finally{await rm(root,{recursive:true,force:true});}
});
