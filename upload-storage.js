import {mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export const UPLOAD_TYPES={
 'image/png':{ext:'png',test:b=>b.length>24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&b.toString('ascii',12,16)==='IHDR'},
 'image/jpeg':{ext:'jpg',test:b=>b.length>4&&b[0]===255&&b[1]===216&&b[2]===255&&b[b.length-2]===255&&b[b.length-1]===217},
 'image/webp':{ext:'webp',test:b=>b.length>16&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'},
 'image/gif':{ext:'gif',test:b=>b.length>13&&['GIF87a','GIF89a'].includes(b.toString('ascii',0,6))},
 'video/mp4':{ext:'mp4',test:b=>b.length>=24&&b.toString('ascii',4,8)==='ftyp'&&/isom|iso[2-9]|mp4[12]|avc1|M4V /.test(b.toString('ascii',8,32))},
 'video/webm':{ext:'webm',test:b=>b.length>16&&b.subarray(0,4).equals(Buffer.from([26,69,223,163]))&&b.subarray(0,4096).includes(Buffer.from('webm'))}
};
const folders={'site-image':'site/images','hero-video':'site/videos','video-cover':'videos/covers'};
const fail=(status,message)=>Object.assign(new Error(message),{status});
export async function storeUpload(req,kind,root){
 const folder=folders[kind];if(!folder)throw fail(400,'Unknown upload category.');
 const type=req.headers['content-type']?.split(';')[0].trim().toLowerCase(),format=UPLOAD_TYPES[type];
 if(!format||!type.startsWith(kind==='hero-video'?'video/':'image/'))throw fail(415,'Use PNG, JPEG, WebP or GIF images, or MP4/WebM hero videos.');
 const limit=(kind==='hero-video'?90:20)*1024*1024;
 if(Number(req.headers['content-length'])>limit)throw fail(413,'File exceeds the '+(kind==='hero-video'?90:20)+' MiB limit.');
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw fail(413,'File exceeds the upload size limit.');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);if(!format.test(bytes))throw fail(400,'File content does not match its declared media type.');
 const name=createHash('sha256').update(bytes).digest('hex')+'.'+format.ext,directory=join(root,folder),target=join(directory,name);
 await mkdir(directory,{recursive:true});try{await writeFile(target,bytes,{flag:'wx',mode:0o644});}catch(e){if(e.code!=='EEXIST')throw e;}
 const saved=await readFile(target);if(!saved.equals(bytes))throw new Error('Uploaded file verification failed.');
 return {path:'assets/uploads/'+folder+'/'+name,size,type};
}
export async function serveUpload(req,res,path,root){
 const match=path.match(/^assets\/uploads\/((?:site\/(?:images|videos)|videos\/covers)\/[a-f0-9]{64}\.(png|jpg|webp|gif|mp4|webm))$/);if(!match)return false;
 const file=join(root,match[1]),info=await stat(file);if(!info.isFile())return false;
 const type=Object.entries(UPLOAD_TYPES).find(([,v])=>v.ext===match[2])[0];
 const headers={'Content-Type':type,'X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Cache-Control':'public, max-age=31536000, immutable'};
 let start=0,end=info.size-1,status=200;
 if(req.headers.range){const r=req.headers.range.match(/^bytes=(\d*)-(\d*)$/);if(!r||(!r[1]&&!r[2])){res.writeHead(416,{'Content-Range':'bytes */'+info.size});res.end();return true;}
  if(!r[1])start=Math.max(0,info.size-Number(r[2]));else{start=Number(r[1]);if(r[2])end=Math.min(end,Number(r[2]));}
  if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':'bytes */'+info.size});res.end();return true;}status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
 }
 headers['Content-Length']=end-start+1;res.writeHead(status,headers);
 if(req.method==='HEAD')res.end();else{const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);}return true;
}
