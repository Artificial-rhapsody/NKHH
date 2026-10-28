import { hashPassword,verifyPassword } from './password.js';
import {readGithubJson,writeGithubJson,writeGithubBytes,githubStatus} from './github-content.js';
import {validateSite,validatePageEdit} from './site-validation.js';
import {validateVideos} from './video-validation.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(status,message)=>Object.assign(new Error(message),{status});
const publicUser=user=>({id:user.id,username:user.username,email:user.email,role:user.role});
async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function currentUser(request,env){
 const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
 if(!token) throw fail(401,'Please log in.');
 const user=await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first();
 if(!user) throw fail(401,'Your session has expired. Please log in again.');
 return user;
}
async function body(request){
 if(!request.headers.get('Content-Type')?.startsWith('application/json')) throw fail(415,'The request must use JSON.');
 const reader=request.body?.getReader(); if(!reader) throw fail(400,'The request is empty.');
 let chunks=[],length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>8192){await reader.cancel();throw fail(413,'The request is too large.');}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail(400,'Invalid JSON.');}
}
async function bodyLimit(request,limit){
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw fail(415,'The request must use JSON.');
 const reader=request.body?.getReader();if(!reader)throw fail(400,'The request is empty.');
 let chunks=[],length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw fail(413,'The request is too large.');}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail(400,'Invalid JSON.');}
}
async function rate(request,env){
 const now=Date.now(),bucket=Math.floor(now/600000),ip=request.headers.get('CF-Connecting-IP')||'local';
 const key=await digest(ip+':'+bucket);
 const row=await env.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+600000).first();
 if(row.count>30)throw fail(429,'Too many requests. Please try again later.');
 await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now).run();
}
async function route(request,env){
 const path=new URL(request.url).pathname;
 if(request.method==='GET'&&path==='/api/deployment/status'){
  const user=await currentUser(request,env);if(user.role!=='admin')throw fail(403,'Administrator access is required.');
  return json({github:githubStatus(env)});
 }
 if(request.method==='GET'&&['/api/auth/me','/api/admin/check'].includes(path)){
  const user=await currentUser(request,env);if(path==='/api/admin/check'&&user.role!=='admin')throw fail(403,'Administrator access is required.');return json({user:publicUser(user)});
 }
 if(request.method==='GET'&&path==='/api/content'){
  const user=await currentUser(request,env);if(user.role!=='admin')throw fail(403,'Administrator access is required.');
  const result=await readGithubJson(env,'site.json');validateSite(result.data);return json({site:result.data,revision:result.revision});
 }
 if(request.method==='GET'&&path==='/api/videos'){
  const user=await currentUser(request,env);if(user.role!=='admin')throw fail(403,'Administrator access is required.');
  const result=await readGithubJson(env,'videos.json');validateVideos(result.data.videos);return json({videos:result.data.videos,revision:result.revision});
 }
 if(request.method==='POST'&&path==='/api/content'){
  const user=await currentUser(request,env);if(user.role!=='admin')throw fail(403,'Administrator access is required.');
  const data=await bodyLimit(request,262144);if(!data||typeof data!=='object'||!data.site||typeof data.revision!=='string')throw fail(400,'Homepage content and revision are required.');
  const current=await readGithubJson(env,'site.json');validatePageEdit(data.site,current.data);if(data.revision!==current.revision)throw fail(409,'The homepage has changed. Reload before editing.');
  const saved=await writeGithubJson(env,'site.json',data.site,data.revision,'Update homepage content from administrator');return json({site:saved.data,revision:saved.revision});
 }
 if(request.method==='POST'&&path==='/api/videos'){
  const user=await currentUser(request,env);if(user.role!=='admin')throw fail(403,'Administrator access is required.');
  const data=await bodyLimit(request,524288);if(!data||typeof data!=='object'||!Array.isArray(data.videos)||typeof data.revision!=='string')throw fail(400,'Video library and revision are required.');
  validateVideos(data.videos);const current=await readGithubJson(env,'videos.json');if(data.revision!==current.revision)throw fail(409,'The video library has changed. Reload before editing.');
  const saved=await writeGithubJson(env,'videos.json',{videos:data.videos},data.revision,'Update video library from administrator');return json({videos:saved.data.videos,revision:saved.revision});
 }
 if(request.method==='POST'&&path==='/api/upload'){
  const user=await currentUser(request,env);if(user.role!=='admin')throw fail(403,'Administrator access is required.');
  const kind=new URL(request.url).searchParams.get('kind');const config={
   'site-image':{folder:'assets/uploads/site/images',limit:20,types:{'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}},
   'video-cover':{folder:'assets/uploads/videos/covers',limit:20,types:{'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}},
   'hero-video':{folder:'assets/uploads/site/videos',limit:90,types:{'video/mp4':'mp4','video/webm':'webm'}}
  }[kind];if(!config)throw fail(400,'Unknown upload category.');
  const type=request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();if(!config.types[type])throw fail(415,'Unsupported media type.');const limit=config.limit*1024*1024;const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.length>limit)throw fail(413,'File exceeds the upload size limit.');
  const valid=type==='image/png'?bytes.length>24&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&String.fromCharCode(...bytes.subarray(12,16))==='IHDR':type==='image/jpeg'?bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217:type==='image/webp'?bytes.length>16&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP':type==='image/gif'?bytes.length>13&&['GIF87a','GIF89a'].includes(String.fromCharCode(...bytes.subarray(0,6))):type==='video/mp4'?bytes.length>=24&&String.fromCharCode(...bytes.subarray(4,8))==='ftyp':bytes.length>16&&bytes[0]===26&&bytes[1]===69&&bytes[2]===223&&bytes[3]===163;
  if(!valid)throw fail(400,'File content does not match its declared media type.');const hash=await crypto.subtle.digest('SHA-256',bytes);const hex=[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');const path=`${config.folder}/${hex}.${config.types[type]}`;return json(await writeGithubBytes(env,path,bytes,'Upload media from administrator'),201);
 }
 if(request.method==='POST'&&path==='/api/auth/logout'){
  await currentUser(request,env);const token=request.headers.get('Authorization').slice(7);await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();return json({ok:true});
 }
 if(request.method!=='POST'||!['/api/auth/register','/api/auth/login'].includes(path))throw fail(404,'Endpoint not found.');
 await rate(request,env);const data=await body(request);
 if(!data||typeof data!=='object'||Array.isArray(data))throw fail(400,'The request must be an object.');
 if(typeof data.password!=='string'||data.password.length<10||data.password.length>128)throw fail(400,'Passwords must contain 10–128 characters.');
 if(path==='/api/auth/register'){
  if(data.role!==undefined)throw fail(400,'Account roles cannot be selected during registration.');
  const username=typeof data.username==='string'?data.username.trim():'';const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
  if(!/^[\p{L}\p{N}_-]{2,32}$/u.test(username))throw fail(400,'Usernames must contain 2–32 letters, numbers, underscores or hyphens.');
  if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail(400,'Invalid email address.');
  const hashed=await hashPassword(data.password);const user={id:crypto.randomUUID(),username,email,role:'user'};
  try{await env.DB.prepare('INSERT INTO users(id,username,email,role,password_hash,salt,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.id,username,email,'user',hashed.hash,hashed.salt,Date.now()).run();}
  catch(error){if(String(error).includes('UNIQUE constraint'))throw fail(409,'This username or email address is already registered.');throw error;}
  return json({user},201);
 }
 const identifier=typeof data.identifier==='string'?data.identifier.trim().toLowerCase():'';
 if(!identifier||identifier.length>254)throw fail(400,'Enter your username or email address.');
 const user=await env.DB.prepare('SELECT * FROM users WHERE email=? OR username=?').bind(identifier,identifier).first();
 const valid=await verifyPassword(data.password,user?.salt||'00000000000000000000000000000000',user?.password_hash||'0'.repeat(64));
 if(!user||!valid)throw fail(401,'Incorrect username, email address or password.');
 const token=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
 await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()),env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),user.id,Date.now()+86400000)]);
 return json({token,user:publicUser(user)});
}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin');const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(v=>v.trim());
 if(origin&&!allowed.includes(origin))return json({error:'Origin not allowed.'},403);
 let response;
 try{response=request.method==='OPTIONS'?new Response(null,{status:204}):await route(request,env);}catch(error){response=json({error:error.status?error.message:'The service is temporarily unavailable.'},error.status||500);if(!error.status)console.error('auth internal error',error.name);}
 if(origin){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin');response.headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');response.headers.set('Access-Control-Allow-Headers','Content-Type,Authorization');}
 return response;
}};
