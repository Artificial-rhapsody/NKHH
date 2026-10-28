const API_VERSION='2022-11-28';
const fail=(status,message)=>Object.assign(new Error(message),{status});

function settings(env){
 const owner=env.GITHUB_OWNER?.trim();
 const repo=env.GITHUB_REPO?.trim();
 const branch=(env.GITHUB_BRANCH||'main').trim();
 const token=env.GITHUB_TOKEN?.trim();
 if(!owner||!repo||!branch||!token)throw fail(503,'GitHub publishing is not configured on this Worker.');
 if(!/^[A-Za-z0-9_.-]+$/.test(owner)||!/^[A-Za-z0-9_.-]+$/.test(repo)||!/^[A-Za-z0-9_.\-/]+$/.test(branch))throw fail(503,'GitHub publishing configuration is invalid.');
 return {owner,repo,branch,token};
}
function apiUrl(config,path){
 return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(config.branch)}`;
}
async function githubFetch(env,path,init={}){
 const config=settings(env);
 const response=await fetch(apiUrl(config,path),{...init,headers:{Accept:'application/vnd.github+json','Authorization':'Bearer '+config.token,'X-GitHub-Api-Version':API_VERSION,'User-Agent':'keohh-story-interview-worker',...(init.headers||{})}});
 if(response.ok)return response;
 if(response.status===404)throw fail(503,`GitHub file not found: ${path}`);
 if(response.status===409)throw fail(409,'The GitHub branch changed while publishing. Reload and retry.');
 if(response.status===401||response.status===403)throw fail(503,'The Worker GitHub credential cannot access the configured repository.');
 throw fail(502,`GitHub API returned HTTP ${response.status}.`);
}
async function githubRawFetch(env,path,init={}){
 const config=settings(env);
 return fetch(apiUrl(config,path),{...init,headers:{Accept:'application/vnd.github+json','Authorization':'Bearer '+config.token,'X-GitHub-Api-Version':API_VERSION,'User-Agent':'keohh-story-interview-worker',...(init.headers||{})}});
}
function decodeBase64(value){
 const binary=atob(value.replace(/\s/g,''));
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return new TextDecoder().decode(bytes);
}
function encodeBase64(value){
 const bytes=new TextEncoder().encode(value);
 let binary='';
 for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(binary);
}
function encodeBytes(bytes){
 let binary='';
 for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(binary);
}
export async function digest(value){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function readGithubJson(env,path){
 const response=await githubFetch(env,path);
 const payload=await response.json();
 if(payload.type!=='file'||typeof payload.content!=='string'||typeof payload.sha!=='string')throw fail(502,`GitHub returned an invalid file for ${path}.`);
 const raw=decodeBase64(payload.content);
 try{return {data:JSON.parse(raw),raw,sha:payload.sha,revision:await digest(raw)};}catch{throw fail(502,`GitHub file ${path} is not valid JSON.`);}
}
export async function writeGithubJson(env,path,data,expectedRevision,message){
 const current=await readGithubJson(env,path);
 if(current.revision!==expectedRevision)throw fail(409,`The published ${path} has changed. Reload before editing.`);
 const raw=JSON.stringify(data,null,2)+'\n';
 const response=await githubFetch(env,path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,content:encodeBase64(raw),branch:settings(env).branch,sha:current.sha})});
 if(!response.ok)throw fail(502,'GitHub did not accept the published file.');
 const saved=await readGithubJson(env,path);
 if(saved.raw!==raw)throw fail(502,`GitHub read-back verification failed for ${path}.`);
 return {data:saved.data,revision:saved.revision};
}
export async function writeGithubBytes(env,path,bytes,message){
 const current=await githubRawFetch(env,path);let sha;
 if(current.ok)sha=(await current.json()).sha;else if(current.status!==404)throw fail(502,`GitHub API returned HTTP ${current.status}.`);
 const config=settings(env);const response=await githubRawFetch(env,path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,content:encodeBytes(bytes),branch:config.branch,...(sha?{sha}:{})})});
 if(!response.ok)throw fail(response.status===409?409:502,'GitHub did not accept the uploaded file.');
 const saved=await githubRawFetch(env,path,{headers:{Accept:'application/vnd.github.raw'}});if(!saved.ok)throw fail(502,'GitHub upload read-back failed.');
 const stored=new Uint8Array(await saved.arrayBuffer());if(await digestBytes(stored)!==await digestBytes(bytes))throw fail(502,'GitHub upload read-back verification failed.');return {path};
}
async function digestBytes(bytes){const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function githubStatus(env){
 try{const config=settings(env);return {configured:true,owner:config.owner,repo:config.repo,branch:config.branch};}
 catch{return {configured:false};}
}
