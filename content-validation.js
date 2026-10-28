import { readFileSync } from 'node:fs';
const reference=JSON.parse(readFileSync(new URL('./site.json',import.meta.url),'utf8'));
export function validateSite(site) {
 let count=0;
 function check(value,model,path) {
  if(++count>5000) throw new Error('Too much content.');
  if(typeof model==='string') {
   if(typeof value!=='string'||value.length>20000) throw new Error(`${path}: Invalid text type or length`);
   if(/\.(src|url|href|brandHref|skipHref|topHref)$/.test(path)&&value) {
    if(/[\u0000-\u0020\\]/.test(value)) throw new Error(`${path}: The image or link contains invalid characters`);
    const url=new URL(value,'https://site.example/');
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password) throw new Error(`${path}: Unsafe image or link protocol`);
   }
  } else if(Array.isArray(model)) {
   if(!Array.isArray(value)||value.length>100) throw new Error(`${path}: Invalid list`);
   if((path==='header.links'&&value.length<4)||(value.length<1&&!path.endsWith('.tags'))) throw new Error(`${path}: The list cannot be empty`);
   value.forEach((item,i)=>check(item,model[0]??'',`${path}.${i}`));
  } else {
   if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error(`${path}: Invalid object`);
   if(Object.keys(value).sort().join('|')!==Object.keys(model).sort().join('|')) throw new Error(`${path}: Missing or unknown fields`);
   for(const key of Object.keys(model)) check(value[key],model[key],path?`${path}.${key}`:key);
  }
 }
 check(site,reference,'');
 const media=site.sections.hero.media;
 if(!['image','video','vimeo'].includes(media.type))throw new Error('Invalid hero media type.');
 if(media.type==='video'&&!/^assets\/uploads\/site\/videos\/[a-f0-9]{64}\.(mp4|webm)$/.test(media.src))throw new Error('Select an uploaded MP4 or WebM hero video.');
 if(media.type==='vimeo'){
  let url;try{url=new URL(media.src);}catch{throw new Error('Enter a Vimeo video URL.');}
  if(url.protocol!=='https:'||!['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(url.hostname)||!(url.hostname==='player.vimeo.com'?/^\/video\/\d+\/?$/:/^\/(\d+)(?:\/[a-zA-Z0-9]+)?\/?$|^\/reviews\/[a-zA-Z0-9-]+\/videos\/\d+\/?$/).test(url.pathname))throw new Error('Enter a supported Vimeo video URL.');
 }
 return site;
}
export function validatePageEdit(site,current) {
 validateSite(site);
 for(const path of ['sections.videos.cards','sections.layouts.mainCard','sections.layouts.sideCard','videoDialog']){
  const get=data=>path.split('.').reduce((v,key)=>v?.[key],data);
  if(JSON.stringify(get(site))!==JSON.stringify(get(current)))throw new Error('Manage video records in the Video library; the page editor cannot overwrite them.');
 }
 return site;
}
