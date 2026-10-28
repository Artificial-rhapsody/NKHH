(() => {
 const editing=new URLSearchParams(location.search).get('editor')==='1'&&parent!==window;
 if(!editing)return;
 try{if(new URL(parent.location.href).origin!==location.origin||!parent.location.pathname.endsWith('/admin.html'))return;}catch{return;}
 document.documentElement.classList.add('editing-preview');
 const selector='[data-site-text],[data-site-lines],[data-site-image],[data-site-attrs],[data-site-card]';
 function paths(node){const result=[];for(const name of ['siteText','siteLines','siteImage','siteCard'])if(node.dataset[name])result.push(node.dataset[name]);if(node.dataset.siteAttrs)result.push(...Object.values(JSON.parse(node.dataset.siteAttrs)));return [...new Set(result)];}
 document.addEventListener('click',event=>{const button=event.target.closest('[data-site-select]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();parent.postMessage({type:'editor:select',paths:JSON.parse(button.dataset.siteSelect)},location.origin);},true);
 function mark(){document.querySelectorAll(selector).forEach(node=>{if(node.tagName!=='TITLE'&&node.tagName!=='HTML'&&!paths(node).some(window.SiteContentPolicy.isVideoManaged))node.classList.add('editable-element');});
  for(const [container,items] of [['.hero',[['Hero media',['sections.hero.media','sections.hero.image']]]],['.intro',[['Image',['sections.intro.image']],['Background image',['sections.intro.backgroundImage']],['Image mask',['sections.intro.maskImage']]]]]){
   const area=document.querySelector(container);if(area.querySelector('.editor-media-tools'))continue;const toolbar=document.createElement('div');toolbar.className='editor-media-tools';
   for(const [label,selected] of items){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.siteSelect=JSON.stringify(selected);toolbar.append(button);}area.append(toolbar);
  }parent.postMessage({type:'editor:ready'},location.origin);}
 document.addEventListener('click',event=>{if(event.target.closest('#moments-content,#archive-stage,.video-empty')){event.preventDefault();event.stopImmediatePropagation();parent.postMessage({type:'editor:select',paths:['videoLibrary']},location.origin);return;}const node=event.target.closest(selector);if(!node||node.tagName==='HTML')return;event.preventDefault();event.stopImmediatePropagation();const selected=paths(node);if(selected.some(window.SiteContentPolicy.isVideoManaged)){parent.postMessage({type:'editor:select',paths:selected},location.origin);return;}document.querySelectorAll('.editor-selected').forEach(n=>n.classList.remove('editor-selected'));node.classList.add('editor-selected');parent.postMessage({type:'editor:select',paths:selected},location.origin);},true);

 window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='editor:render')return;const x=scrollX,y=scrollY;try{window.SitePage.render(event.data.site);scrollTo(x,y);}catch(error){parent.postMessage({type:'editor:error',message:error.message},location.origin);}});
 document.addEventListener('site:ready',mark);if(document.documentElement.dataset.siteReady==='true')mark();
})();
