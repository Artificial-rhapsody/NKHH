import { hashPassword,verifyPassword } from './password.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(status,message)=>Object.assign(new Error(message),{status});
const publicUser=user=>({id:user.id,username:user.username,email:user.email,role:user.role});
async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function currentUser(request,env){
 const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
 if(!token) throw fail(401,'请先登录');
 const user=await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first();
 if(!user) throw fail(401,'登录已失效，请重新登录');
 return user;
}
async function body(request){
 if(!request.headers.get('Content-Type')?.startsWith('application/json')) throw fail(415,'请求必须为 JSON');
 const reader=request.body?.getReader(); if(!reader) throw fail(400,'请求为空');
 let chunks=[],length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>8192){await reader.cancel();throw fail(413,'请求过大');}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail(400,'JSON 格式无效');}
}
async function rate(request,env){
 const now=Date.now(),bucket=Math.floor(now/600000),ip=request.headers.get('CF-Connecting-IP')||'local';
 const key=await digest(ip+':'+bucket);
 const row=await env.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+600000).first();
 if(row.count>30)throw fail(429,'请求过于频繁，请稍后再试');
 await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now).run();
}
async function route(request,env){
 const path=new URL(request.url).pathname;
 if(request.method==='GET'&&['/api/auth/me','/api/admin/check'].includes(path)){
  const user=await currentUser(request,env);if(path==='/api/admin/check'&&user.role!=='admin')throw fail(403,'仅管理员可执行此操作');return json({user:publicUser(user)});
 }
 if(request.method==='POST'&&path==='/api/auth/logout'){
  await currentUser(request,env);const token=request.headers.get('Authorization').slice(7);await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();return json({ok:true});
 }
 if(request.method!=='POST'||!['/api/auth/register','/api/auth/login'].includes(path))throw fail(404,'接口不存在');
 await rate(request,env);const data=await body(request);
 if(!data||typeof data!=='object'||Array.isArray(data))throw fail(400,'请求必须是对象');
 if(typeof data.password!=='string'||data.password.length<10||data.password.length>128)throw fail(400,'密码须为 10–128 个字符');
 if(path==='/api/auth/register'){
  if(data.role!==undefined)throw fail(400,'不能自行设置用户等级');
  const username=typeof data.username==='string'?data.username.trim():'';const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
  if(!/^[\p{L}\p{N}_-]{2,32}$/u.test(username))throw fail(400,'用户名须为 2–32 个汉字、字母、数字、下划线或短横线');
  if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail(400,'邮箱格式无效');
  const hashed=await hashPassword(data.password);const user={id:crypto.randomUUID(),username,email,role:'user'};
  try{await env.DB.prepare('INSERT INTO users(id,username,email,role,password_hash,salt,created_at) VALUES(?,?,?,?,?,?,?)').bind(user.id,username,email,'user',hashed.hash,hashed.salt,Date.now()).run();}
  catch(error){if(String(error).includes('UNIQUE constraint'))throw fail(409,'用户名或邮箱已被注册');throw error;}
  return json({user},201);
 }
 const identifier=typeof data.identifier==='string'?data.identifier.trim().toLowerCase():'';
 if(!identifier||identifier.length>254)throw fail(400,'请输入用户名或邮箱');
 const user=await env.DB.prepare('SELECT * FROM users WHERE email=? OR username=?').bind(identifier,identifier).first();
 const valid=await verifyPassword(data.password,user?.salt||'00000000000000000000000000000000',user?.password_hash||'0'.repeat(64));
 if(!user||!valid)throw fail(401,'用户名／邮箱或密码不正确');
 const token=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
 await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()),env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),user.id,Date.now()+86400000)]);
 return json({token,user:publicUser(user)});
}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin');const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(v=>v.trim());
 if(origin&&!allowed.includes(origin))return json({error:'来源不允许'},403);
 let response;
 try{response=request.method==='OPTIONS'?new Response(null,{status:204}):await route(request,env);}catch(error){response=json({error:error.status?error.message:'服务暂时不可用'},error.status||500);if(!error.status)console.error('auth internal error',error.name);}
 if(origin){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin');response.headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');response.headers.set('Access-Control-Allow-Headers','Content-Type,Authorization');}
 return response;
}};
