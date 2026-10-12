import { readFileSync } from 'node:fs';
const reference=JSON.parse(readFileSync(new URL('./site.json',import.meta.url),'utf8'));
export function validateSite(site) {
 let count=0;
 function check(value,model,path) {
  if(++count>5000) throw new Error('内容过多');
  if(typeof model==='string') {
   if(typeof value!=='string'||value.length>20000) throw new Error(`${path}: 文字格式或长度无效`);
   if(/\.(src|href|brandHref|skipHref|topHref)$/.test(path)&&value) {
    if(/[\u0000-\u0020\\]/.test(value)) throw new Error(`${path}: 图片或链接包含非法字符`);
    const url=new URL(value,'https://site.example/');
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password) throw new Error(`${path}: 图片或链接协议不安全`);
   }
  } else if(Array.isArray(model)) {
   if(!Array.isArray(value)||value.length>100) throw new Error(`${path}: 列表格式无效`);
   if((path==='header.links'&&value.length<4)||(value.length<1)) throw new Error(`${path}: 列表不能为空`);
   value.forEach((item,i)=>check(item,model[0],`${path}.${i}`));
  } else {
   if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error(`${path}: 对象格式无效`);
   if(Object.keys(value).sort().join('|')!==Object.keys(model).sort().join('|')) throw new Error(`${path}: 字段不完整或未知`);
   for(const key of Object.keys(model)) check(value[key],model[key],path?`${path}.${key}`:key);
  }
 }
 check(site,reference,'');
 return site;
}
