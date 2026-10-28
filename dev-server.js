import http from 'node:http';
import { readFile,writeFile,rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { validateSite,validatePageEdit } from './content-validation.js';
import {validateVideos} from './video-validation.js';
import {storeUpload,serveUpload} from './upload-storage.js';
import {fileURLToPath} from 'node:url';
const ROOT=new URL('./',import.meta.url),target=new URL('site.json',ROOT);
const hash=text=>createHash('sha256').update(text).digest('hex');
async function content(){const raw=await readFile(target,'utf8');return {site:JSON.parse(raw),revision:hash(raw)};}
async function videoContent(){const raw=await readFile(new URL('videos.json',ROOT),'utf8');return {...JSON.parse(raw),revision:hash(raw)};}
const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
export const publicFiles=['index.html','site.json','style.css','script.js','config.js','auth.js','auth.css','admin.html','admin.js','admin.css','editor-preview.js','editor-preview.css','response-utils.js','video.html','video.css','video.js','content-policy.js','videos.json','video-admin.js','media-upload.js'];
const allowed=new Set(publicFiles);
export function createDevServer({workerBase='http://127.0.0.1:8787',uploadRoot=fileURLToPath(new URL('assets/uploads/',ROOT))}={}){
 let publishing=false;
 return http.createServer(async(req,res)=>{
  try{
   const host=req.headers.host;
   if(!/^(localhost|127\.0\.0\.1):\d+$/.test(host||''))return send(res,403,{error:'Host not allowed.'});
   const url=new URL(req.url,`http://${host}`),origin=req.headers.origin;
   if(origin&&origin!==url.origin)return send(res,403,{error:'Origin not allowed.'});
   if(url.pathname.startsWith('/api/')){
    try{
     const upstream=await fetch(workerBase+url.pathname,{method:req.method,headers:{'Content-Type':req.headers['content-type']||'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{}),...(origin?{Origin:origin}:{})},body:['GET','HEAD'].includes(req.method)?undefined:req,duplex:'half',signal:AbortSignal.timeout(10000)});
     const raw=await upstream.text();let data;
     try{data=JSON.parse(raw);}catch{return send(res,502,{error:'The authentication service returned an empty or invalid response. Check npm run worker:dev.'});}
     return send(res,upstream.status,data);
    }catch{return send(res,503,{error:'Unable to connect to authentication. Run npm run worker:dev in the project directory and retry.'});}
   }
   if(req.method==='GET'&&url.pathname==='/__local/content')return send(res,200,await content());
   if(req.method==='POST'&&url.pathname==='/__local/upload'){
    if(origin!==url.origin)return send(res,403,{error:'Origin not allowed.'});
    const check=await fetch(workerBase+'/api/admin/check',{headers:{Authorization:req.headers.authorization||''},signal:AbortSignal.timeout(10000)});
    if(!check.ok)return send(res,check.status,{error:'Administrator access is required.'});
    return send(res,201,await storeUpload(req,url.searchParams.get('kind'),uploadRoot));
   }
   if(req.method==='GET'&&url.pathname==='/__local/videos')return send(res,200,await videoContent());
   if(req.method==='POST'&&url.pathname==='/__local/videos'){
    if(origin!==url.origin)return send(res,403,{error:'Origin not allowed.'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON is required.'});
    const check=await fetch(workerBase+'/api/admin/check',{headers:{Authorization:req.headers.authorization||''},signal:AbortSignal.timeout(10000)});if(!check.ok)return send(res,check.status,await check.json());
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>524288)return send(res,413,{error:'Video metadata is too large.'});chunks.push(chunk);}
    const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));validateVideos(data.videos);
    if(publishing)return send(res,409,{error:'Publishing is in progress. Please retry shortly.'});publishing=true;
    try{const current=await videoContent();if(data.revision!==current.revision)return send(res,409,{error:'The video library has changed. Reload before editing.'});
     const raw=JSON.stringify({videos:data.videos},null,2)+'\n';const tmp=new URL('videos.json.tmp',ROOT);await writeFile(tmp,raw);await rename(tmp,new URL('videos.json',ROOT));const saved=await videoContent();if(JSON.stringify(saved.videos)!==JSON.stringify(data.videos))throw new Error('Video library verification failed.');return send(res,200,saved);
    }finally{publishing=false;}
   }
   if(req.method==='POST'&&url.pathname==='/__local/publish'){
    if(origin!==url.origin)return send(res,403,{error:'Publication must originate from this page.'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON is required.'});
    const check=await fetch(workerBase+'/api/admin/check',{headers:{Authorization:req.headers.authorization||''},signal:AbortSignal.timeout(10000)});
    if(!check.ok)return send(res,check.status,await check.json());
    const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>262144)return send(res,413,{error:'Content is too large.'});chunks.push(chunk);}
    const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));validateSite(data.site);
    if(publishing)return send(res,409,{error:'Another publication is in progress. Please retry.'});
    publishing=true;
    try{
     const current=await content();
     if(data.revision!==current.revision)return send(res,409,{error:'The homepage has changed. Reload before editing.'});
     validatePageEdit(data.site,current.site);
     const tmp=new URL('site.json.tmp',ROOT);await writeFile(tmp,JSON.stringify(data.site,null,2)+'\n',{mode:0o644});await rename(tmp,target);
     const saved=await content();if(JSON.stringify(saved.site)!==JSON.stringify(data.site))throw new Error('Published content verification failed.');
     return send(res,200,saved);
    }finally{publishing=false;}
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Method not allowed.'});
   const path=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
   if(await serveUpload(req,res,path,uploadRoot))return;
   if(!allowed.has(path)&&!/^assets\/(images|temp)\/[^/]+\.(png|jpg|jpeg|webp|svg)$/i.test(path))return send(res,404,{error:'File not found.'});
   const data=await readFile(new URL(path,ROOT));const ext=path.split('.').pop();
   const type={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css',json:'application/json',jpg:'image/jpeg',png:'image/png',svg:'image/svg+xml'}[ext]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
  }catch(error){send(res,error.code==='ENOENT'?404:error.status||400,{error:error.code==='ENOENT'?'File not found.':error.message});}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){createDevServer().listen(8000,'127.0.0.1',()=>console.log('Local site: http://127.0.0.1:8000 (auth Worker: 8787)'));}
