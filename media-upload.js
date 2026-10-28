(() => {
 const limits={'site-image':20,'video-cover':20,'hero-video':90};
 function picker(kind,onUploaded){
  const area=document.createElement('div');area.className='media-upload';
  const file=document.createElement('input');file.type='file';file.accept=kind==='hero-video'?'video/mp4,video/webm':'image/png,image/jpeg,image/webp,image/gif';file.setAttribute('aria-label',kind==='hero-video'?'Upload hero video':'Upload image');
  const progress=document.createElement('progress');progress.max=100;progress.hidden=true;
  const note=document.createElement('small');note.setAttribute('role','status');note.textContent=`${kind==='hero-video'?'MP4 / WebM':'PNG / JPEG / WebP / GIF'} · max ${limits[kind]} MiB`;
  file.onchange=async()=>{
   const selected=file.files[0];if(!selected)return;
   if(selected.size>limits[kind]*1024*1024){note.textContent='File exceeds the '+limits[kind]+' MiB limit.';file.value='';return;}
   const local=['localhost','127.0.0.1'].includes(location.hostname),base=window.APP_CONFIG?.apiBase||'';
   if(!local&&!base){note.textContent='Online uploading is not configured. Set the public Worker API URL.';return;}
   file.disabled=true;progress.hidden=false;progress.value=0;note.textContent='Uploading…';window.dispatchEvent(new CustomEvent('media:upload',{detail:1}));
   try{
    const result=await new Promise((resolve,reject)=>{
     const xhr=new XMLHttpRequest();xhr.open('POST',local?'/__local/upload?kind='+kind:base+'/api/upload?kind='+kind);xhr.timeout=180000;xhr.setRequestHeader('Content-Type',selected.type||'application/octet-stream');const token=JSON.parse(sessionStorage.getItem('story.session')||'null')?.token;xhr.setRequestHeader('Authorization','Bearer '+(token||''));
     xhr.upload.onprogress=e=>{if(e.lengthComputable){progress.value=e.loaded/e.total*100;note.textContent='Uploading… '+Math.round(progress.value)+'%';}};
     xhr.onerror=()=>reject(new Error('Upload failed. Check the local server.'));xhr.ontimeout=()=>reject(new Error('Upload timed out.'));
     xhr.onload=()=>{try{const data=JSON.parse(xhr.responseText);if(xhr.status<200||xhr.status>=300)throw new Error(data.error||'Upload failed.');resolve(data);}catch(e){reject(e);}};xhr.send(selected);
    });
    await onUploaded(result.path);note.textContent='Uploaded and verified. Publish your draft to make it public.';
   }catch(e){note.textContent=e.message;}finally{file.disabled=false;file.value='';progress.hidden=true;window.dispatchEvent(new CustomEvent('media:upload',{detail:-1}));}
  };
  area.append(file,progress,note);return area;
 }
 window.SiteUploads={picker};
})();
