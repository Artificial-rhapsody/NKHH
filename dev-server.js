import http from 'node:http';
import { readFile,writeFile,rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { validateSite } from './content-validation.js';
const ROOT=new URL('./',import.meta.url),target=new URL('site.json',ROOT);
const hash=text=>createHash('sha256').update(text).digest('hex');
async function content(){const raw=await readFile(target,'utf8');return {site:JSON.parse(raw),revision:hash(raw)};}
const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
const allowed=new Set(['index.html','site.json','style.css','script.js','config.js','auth.js','auth.css','admin.html','admin.js','admin.css','editor-preview.js','editor-preview.css']);
export function createDevServer({workerBase='http://127.0.0.1:8787'}={}){
 let publishing=false;
 return http.createServer(async(req,res)=>{
  try{
   const host=req.headers.host;
   if(!/^(localhost|127\.0\.0\.1):\d+$/.test(host||''))return send(res,403,{error:'Host 不允许'});
   const url=new URL(req.url,`http://${host}`),origin=req.headers.origin;
   if(origin&&origin!==url.origin)return send(res,403,{error:'来源不允许'});
   if(url.pathname.startsWith('/api/')){
    const upstream=await fetch(workerBase+url.pathname,{method:req.method,headers:{'Content-Type':req.headers['content-type']||'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{}),...(origin?{Origin:origin}:{})},body:['GET','HEAD'].includes(req.method)?undefined:req,duplex:'half'});
    res.writeHead(upstream.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(await upstream.text());return;
   }
   if(req.method==='GET'&&url.pathname==='/__local/content')return send(res,200,await content());
   if(req.method==='POST'&&url.pathname==='/__local/publish'){
    if(origin!==url.origin)return send(res,403,{error:'发布必须来自当前页面'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'需要 JSON'});
    const check=await fetch(workerBase+'/api/admin/check',{headers:{Authorization:req.headers.authorization||''}});
    if(!check.ok)return send(res,check.status,await check.json());
    const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>262144)return send(res,413,{error:'内容过大'});chunks.push(chunk);}
    const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));validateSite(data.site);
    if(publishing)return send(res,409,{error:'另一发布正在进行，请重试'});
    publishing=true;
    try{
     if(data.revision!==(await content()).revision)return send(res,409,{error:'主页已被其他管理员修改，请重新加载后编辑'});
     const tmp=new URL('site.json.tmp',ROOT);await writeFile(tmp,JSON.stringify(data.site,null,2)+'\n',{mode:0o644});await rename(tmp,target);
     const saved=await content();if(JSON.stringify(saved.site)!==JSON.stringify(data.site))throw new Error('发布回读失败');
     return send(res,200,saved);
    }finally{publishing=false;}
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'方法不允许'});
   const path=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
   if(!allowed.has(path)&&!/^assets\/(images|temp)\/[^/]+\.(png|jpg|jpeg|webp|svg)$/i.test(path))return send(res,404,{error:'文件不存在'});
   const data=await readFile(new URL(path,ROOT));const ext=path.split('.').pop();
   const type={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css',json:'application/json',jpg:'image/jpeg',png:'image/png',svg:'image/svg+xml'}[ext]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
  }catch(error){send(res,error.code==='ENOENT'?404:400,{error:error.code==='ENOENT'?'文件不存在':error.message});}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){createDevServer().listen(8000,'127.0.0.1',()=>console.log('Local site: http://127.0.0.1:8000 (auth Worker: 8787)'));}
