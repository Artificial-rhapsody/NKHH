(() => {
 const editing=new URLSearchParams(location.search).get('editor')==='1'&&parent!==window;
 if(!editing)return;
 try{if(new URL(parent.location.href).origin!==location.origin||!parent.location.pathname.endsWith('/admin.html'))return;}catch{return;}
 document.documentElement.classList.add('editing-preview');
 const selector='[data-site-text],[data-site-lines],[data-site-image],[data-site-attrs],[data-site-card]';
 function paths(node){const result=[];for(const name of ['siteText','siteLines','siteImage','siteCard'])if(node.dataset[name])result.push(node.dataset[name]);if(node.dataset.siteAttrs)result.push(...Object.values(JSON.parse(node.dataset.siteAttrs)));return [...new Set(result)];}
 function mark(){document.querySelectorAll(selector).forEach(node=>{if(node.tagName!=='TITLE'&&node.tagName!=='HTML')node.classList.add('editable-element');});parent.postMessage({type:'editor:ready'},location.origin);}
 document.addEventListener('click',event=>{const node=event.target.closest(selector);if(!node)return;event.preventDefault();event.stopImmediatePropagation();document.querySelectorAll('.editor-selected').forEach(n=>n.classList.remove('editor-selected'));node.classList.add('editor-selected');parent.postMessage({type:'editor:select',paths:paths(node)},location.origin);},true);
 window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='editor:render')return;const x=scrollX,y=scrollY,dialogOpen=document.querySelector('#video-dialog').open;try{window.SitePage.render(event.data.site);if(dialogOpen)document.querySelector('#video-dialog').showModal();scrollTo(x,y);}catch(error){parent.postMessage({type:'editor:error',message:error.message},location.origin);}});
 window.addEventListener('message',event=>{if(event.source===parent&&event.origin===location.origin&&event.data?.type==='editor:dialog')document.querySelector('#video-dialog').showModal();});
 document.addEventListener('site:ready',mark);if(document.documentElement.dataset.siteReady==='true')mark();
})();
