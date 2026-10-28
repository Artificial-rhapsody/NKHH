(() => {
 const $=selector=>document.querySelector(selector);
 function safeUrl(value){if(typeof value!=='string'||!value.trim())return null;const url=new URL(value,document.baseURI);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Unsupported video or image URL');return url;}
 function embedUrl(source){
  if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(source.hostname)){
   const id=source.hostname==='youtu.be'?source.pathname.slice(1):source.searchParams.get('v');if(id&&/^[a-zA-Z0-9_-]{11}$/.test(id))return 'https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1';
  }
  if(['www.bilibili.com','bilibili.com'].includes(source.hostname)){const id=source.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/)?.[1];if(id)return 'https://player.bilibili.com/player.html?bvid='+id+'&autoplay=1&danmaku=0';}
  if(source.protocol==='https:'&&['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(source.hostname)){
   const match=source.hostname==='player.vimeo.com'?source.pathname.match(/^\/video\/(\d+)\/?$/):source.pathname.match(/^\/(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/)||source.pathname.match(/^\/reviews\/[a-zA-Z0-9-]+\/videos\/(\d+)\/?$/);
   if(match){const embed=new URL('https://player.vimeo.com/video/'+match[1]);const hash=source.searchParams.get('h')||match[2];if(hash&&/^[a-zA-Z0-9]+$/.test(hash))embed.searchParams.set('h',hash);embed.searchParams.set('autoplay','0');return embed.href;}
  }
  return null;
 }
 async function initialize(){
  const response=await fetch('site.json',{cache:'no-store'});if(!response.ok)throw new Error('The video archive could not be loaded.');
  const site=await window.SiteResponses.readJson(response,'Video archive');const id=new URLSearchParams(location.search).get('id');
  const libraryResponse=await fetch('videos.json',{cache:'no-store'});if(!libraryResponse.ok)throw new Error('The video archive could not be loaded.');const records=(await window.SiteResponses.readJson(libraryResponse,'Video archive')).videos;
  const cards=records.map(v=>({...v,image:v.cover}));const card=id?cards.find(c=>c.id===id):cards[0];
  if(!card){$('#video-error').hidden=false;document.title='Video not found · '+site.header.brand;return;}
  const title=card.title?.trim()||'Untitled video';document.title=title+' · '+site.header.brand;document.querySelector('meta[name="description"]').content=card.description?.trim()||'A video from the Korean Ethnic Oral History Hub archive.';
  document.documentElement.lang=site.meta.language||'en';$('#detail-brand').lastChild.textContent=site.header.brand;$('#video-title').textContent=title;$('#breadcrumb-title').textContent=title;$('#video-number').textContent=card.number?' / '+card.number:'';
  $('#video-description').textContent=card.description?.trim()||'A description has not yet been added for this video.';
  const tags=Array.isArray(card.tags)?[...new Set(card.tags.filter(tag=>typeof tag==='string'&&tag.trim()).map(tag=>tag.trim()))]:[];
  $('#video-tags').replaceChildren(...tags.map(tag=>{const item=document.createElement('li');item.textContent=tag;return item;}));$('#tags-empty').hidden=tags.length>0;
  const cover=$('#video-cover');const coverUrl=safeUrl(card.image?.src);cover.alt=card.image?.alt||title;cover.addEventListener('error',()=>{cover.hidden=true;$('#cover-fallback').hidden=false;});if(coverUrl)cover.src=coverUrl.href;else{cover.hidden=true;$('#cover-fallback').hidden=false;}
  const source=safeUrl(card.url);if(source){
   const link=document.createElement('a');link.href=source.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=source.href;const label=document.createElement('p');label.textContent='Watch on the original platform ↗';$('#video-source').replaceChildren(label,link);
   const embed=embedUrl(source),direct=/\.(mp4|webm|ogg)$/i.test(source.pathname);const play=$('#play-video');play.hidden=!(embed||direct);$('#cover-status').textContent=direct?'WATCH THE VIDEO':source.hostname;
   const mountPlayer=()=>{const player=document.createElement(direct?'video':'iframe');if(direct){player.controls=true;player.autoplay=true;player.poster=coverUrl?.href||'';player.src=source.href;}else{player.src=embed;player.title=title;player.allow='autoplay; fullscreen; picture-in-picture; encrypted-media';player.allowFullscreen=true;player.referrerPolicy='strict-origin-when-cross-origin';}$('#cover-stage').replaceChildren(player);};
   play.onclick=mountPlayer;
   if(embed&&new URL(embed).hostname==='player.vimeo.com')mountPlayer();
  }else $('#cover-status').textContent='VIDEO LINK NOT YET ADDED';
  $('#video-detail').hidden=false;document.documentElement.dataset.videoReady='true';
 }
 initialize().catch(error=>{const box=$('#video-error');box.hidden=false;box.querySelector('h1').textContent='Unable to load video';box.querySelector('p').textContent=error.message;}).finally(()=>$('#video-loading').hidden=true);
})();
