export function validateVideos(videos){
 if(!Array.isArray(videos)||videos.length>200)throw new Error('Invalid video library. A maximum of 200 records is allowed.');
 const ids=new Set();
 for(const video of videos){
  if(!video||typeof video!=='object'||Object.keys(video).sort().join(',')!=='cover,description,id,tags,title,url')throw new Error('Missing or unknown video fields.');
  if(typeof video.id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(video.id)||ids.has(video.id))throw new Error('Invalid or duplicate video ID.');ids.add(video.id);
  for(const [key,max] of [['title',200],['description',20000],['url',2048]])if(typeof video[key]!=='string'||!video[key].trim()||video[key].length>max)throw new Error('Video title, description and URL are required and must fit the length limits.');
  url(video.url,false);
  if(!Array.isArray(video.tags)||video.tags.length>20||video.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>60)||new Set(video.tags).size!==video.tags.length)throw new Error('Use unique text tags: up to 20 tags, each no longer than 60 characters.');
  if(!video.cover||Object.keys(video.cover).sort().join(',')!=='alt,src'||typeof video.cover.alt!=='string'||video.cover.alt.length>500)throw new Error('Invalid cover fields.');
  url(video.cover.src,true);
 }
 return videos;
}
function url(value,local){
 if(typeof value!=='string'||!value.trim()||value.length>2048||/[\u0000-\u0020\\]/.test(value))throw new Error('Invalid video or cover URL.');
 if(local&&/^assets\/(images|temp|uploads)\/[^/]+\.(png|jpe?g|webp)$/i.test(value))return;
 if(local&&/^assets\/uploads\/videos\/covers\/[a-f0-9]{64}\.(png|jpg|webp|gif)$/.test(value))return;
 let parsed;try{parsed=new URL(value);}catch{throw new Error('Enter a complete HTTPS URL. Covers may also use a site asset path.');}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new Error('Only HTTPS URLs are allowed.');
}
