(() => {
 async function readJson(response,label='Service') {
  const raw=await response.text();
  const hint="For local development, run npm run dev and npm run worker:dev, then open http://127.0.0.1:8000/.";
  if(!raw.trim())throw Object.assign(new Error(`${label} returned an empty response (HTTP ${response.status}). ${hint}`),{status:response.status});
  let data;
  try{data=JSON.parse(raw);}catch{throw Object.assign(new Error(`${label} returned invalid JSON (HTTP ${response.status}). ${hint}`),{status:response.status});}
  if(!data||typeof data!=='object'||Array.isArray(data))throw Object.assign(new Error(`${label} returned an invalid response format (HTTP ${response.status}).`),{status:response.status});
  return data;
 }
 function bindBackdrop(dialog,on,close) {
  let start=null;
  const outside=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);};
  on(dialog,'pointerdown',e=>{start=e.isPrimary&&e.button===0&&outside(e)?{x:e.clientX,y:e.clientY,id:e.pointerId}:null;});
  on(dialog,'pointercancel',()=>{start=null;});
  on(dialog,'click',e=>{const from=start;start=null;if(from&&outside(e)&&Math.hypot(e.clientX-from.x,e.clientY-from.y)<=6)close();});
  on(dialog,'close',()=>{start=null;});
 }
 window.SiteResponses={readJson,bindBackdrop};
})();
