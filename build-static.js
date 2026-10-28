import {readFile,writeFile,mkdir,copyFile,stat,lstat,readdir,rm} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {publicFiles} from './dev-server.js';
import {validateSite} from './content-validation.js';
import {validateVideos} from './video-validation.js';
const root=fileURLToPath(new URL('./',import.meta.url));
export async function buildStatic(output=resolve(root,'dev-page')){
 const out=resolve(output);if(out===root||!relative(out,root).startsWith('..'))throw new Error('Output cannot contain the source directory.');
 // Only replace an artifact created by this builder, never an arbitrary directory.
 try{await stat(out);if(!(await readFile(resolve(out,'.keohh-artifact'),'utf8')).startsWith('KEOHH'))throw new Error('Unrecognized output directory.');}catch(e){if(e.code!=='ENOENT')throw e;const entries=await readdir(out).catch(()=>[]);if(entries.length)throw new Error('Refusing to overwrite an unrecognized output directory.');}
 const site=JSON.parse(await readFile(resolve(root,'site.json'),'utf8')),library=JSON.parse(await readFile(resolve(root,'videos.json'),'utf8'));validateSite(site);validateVideos(library.videos);
 const assets=new Set();
 function collect(value,key=''){
  if(typeof value==='string'&&(key==='src'||key==='url')&&value&& !/^https?:\/\//.test(value)){
   if(!/^assets\/(images|temp|uploads)\//.test(value)||value.includes('..')||value.includes('\\')||value.includes('?')||value.includes('#'))throw new Error('Unsafe local media path: '+value);assets.add(value);
  }else if(value&&typeof value==='object')for(const [k,item] of Object.entries(value))collect(item,k);
 }
 collect(site);collect(library);
 for(const asset of assets){const path=resolve(root,asset);if(relative(root,path).startsWith('..'))throw new Error('Asset escapes source root.');let cursor=root;for(const segment of relative(root,path).split(sep)){cursor=resolve(cursor,segment);if((await lstat(cursor)).isSymbolicLink())throw new Error('Symlink assets are not supported.');}if((await stat(path)).size>=100*1024*1024)throw new Error('Asset exceeds GitHub file size limit: '+asset);}
 // Validate before removing the previous build.
 await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
 for(const path of [...publicFiles,...assets]){const target=resolve(out,path);await mkdir(dirname(target),{recursive:true});if(path==='config.js'){const config=`window.APP_CONFIG=Object.assign(${JSON.stringify({apiBase:process.env.PUBLIC_API_BASE||'',publishBase:process.env.PUBLIC_PUBLISH_BASE||''})},window.APP_CONFIG||{});\n`;await writeFile(target,config);}else await copyFile(resolve(root,path),target);}
 await writeFile(resolve(out,'.nojekyll'),'');await writeFile(resolve(out,'.keohh-artifact'),'KEOHH static build\n');
 const result={output:out,files:publicFiles.length+assets.size+2,assets:assets.size};console.log(JSON.stringify(result));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--out'))throw new Error('Usage: node build-static.js [--out directory]');await buildStatic(args[1]);}
