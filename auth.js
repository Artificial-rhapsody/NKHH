(() => {
 let session=null,verified=false,verificationError='';
 try{session=JSON.parse(sessionStorage.getItem('story.session'));}catch{sessionStorage.removeItem('story.session');}
 const isLocal=['localhost','127.0.0.1'].includes(location.hostname);
 async function request(path,options={}){
  const base=window.APP_CONFIG?.apiBase||'';
  if(!isLocal&&!base)throw new Error('The Cloudflare authentication URL has not been configured.');
  const response=await fetch(base+path,{...options,headers:{'Content-Type':'application/json',...(session?.token?{Authorization:'Bearer '+session.token}:{}),...options.headers}});
  const data=await window.SiteResponses.readJson(response,'Authentication service');
  if(!response.ok){if(response.status===401){session=null;verified=false;sessionStorage.removeItem('story.session');updateNav();}throw Object.assign(new Error(data.error||'Request failed'),{status:response.status});}
  return data;
 }
 function updateNav(){if(new URLSearchParams(location.search).has('editor'))return;document.querySelectorAll('a[href="#login"]').forEach(a=>{if(!a.dataset.authLabel)a.dataset.authLabel=a.textContent||'Log in';a.textContent=session?.token?(verified?session.user.username:'Session verification pending'):a.dataset.authLabel;});}
 const dialog=document.createElement('dialog');dialog.id='auth-dialog';dialog.className='auth-dialog';
 dialog.innerHTML=`<div class="auth-heading"><h2 id="auth-title">Log in</h2><button type="button" class="auth-close" aria-label="Close login dialog">×</button></div>
 <div class="auth-tabs"><button type="button" data-mode="login">Log in</button><button type="button" data-mode="register">Register</button></div>
 <form id="auth-login"><label>Username or email<input name="identifier" autocomplete="username" required maxlength="254"></label><label>Password<input name="password" type="password" autocomplete="current-password" required minlength="10" maxlength="128"></label><button class="auth-submit">Log in</button></form>
 <form id="auth-register" hidden><label>Username<input name="username" autocomplete="username" required minlength="2" maxlength="32"></label><label>Email<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>Password (at least 10 characters)<input name="password" type="password" autocomplete="new-password" required minlength="10" maxlength="128"></label><label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="10" maxlength="128"></label><button class="auth-submit">Register</button></form>
 <div id="auth-account" hidden><p id="auth-account-name"></p><a id="auth-admin-link" href="admin.html">Open admin panel</a><button type="button" id="auth-logout">Log out</button></div><button type="button" id="auth-retry" hidden>Retry session verification</button><p id="auth-message" role="status" aria-live="polite"></p>`;
 dialog.setAttribute('aria-labelledby','auth-title');document.body.append(dialog);
 const login=dialog.querySelector('#auth-login'),register=dialog.querySelector('#auth-register'),account=dialog.querySelector('#auth-account'),message=dialog.querySelector('#auth-message');
 function mode(name){login.hidden=name!=='login';register.hidden=name!=='register';account.hidden=true;dialog.querySelector('#auth-retry').hidden=true;dialog.querySelector('.auth-tabs').hidden=false;dialog.querySelector('#auth-title').textContent=name==='login'?'Log in':'Register';message.textContent='';}
 function showAccount(){login.hidden=register.hidden=true;account.hidden=false;dialog.querySelector('#auth-retry').hidden=true;dialog.querySelector('.auth-tabs').hidden=true;dialog.querySelector('#auth-title').textContent='Account';dialog.querySelector('#auth-account-name').textContent=session.user.username+' · '+session.user.role;dialog.querySelector('#auth-admin-link').hidden=session.user.role!=='admin';}
 function open(){if(verified&&session?.user)showAccount();else{mode('login');if(session?.token){message.textContent=verificationError||'Your session could not be verified. Please retry.';dialog.querySelector('#auth-retry').hidden=false;}}dialog.showModal();}
 dialog.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>mode(button.dataset.mode)));
 dialog.querySelector('.auth-close').onclick=()=>dialog.close();
 window.SiteResponses.bindBackdrop(dialog,(node,event,handler)=>node.addEventListener(event,handler),()=>dialog.close());
 document.addEventListener('click',e=>{const link=e.target.closest('a[href="#login"]');if(!link)return;if(new URLSearchParams(location.search).has('editor'))return;e.preventDefault();open();});
 async function logout(){await request('/api/auth/logout',{method:'POST'});session=null;verified=false;sessionStorage.removeItem('story.session');updateNav();dialog.close();if(location.pathname.endsWith('admin.html'))location.href='index.html';}
 dialog.querySelector('#auth-logout').onclick=()=>logout().catch(e=>message.textContent=e.message);
 for(const form of [login,register])form.addEventListener('submit',async e=>{
  e.preventDefault();const values=Object.fromEntries(new FormData(form));
  if(form===register&&values.password!==values.confirmPassword){message.textContent='Passwords do not match.';return;}
  const submit=form.querySelector('button');submit.disabled=true;message.textContent='Submitting…';
  try{
   if(form===register){delete values.confirmPassword;await request('/api/auth/register',{method:'POST',body:JSON.stringify(values)});mode('login');login.elements.identifier.value=values.email;message.textContent='Registration successful. Please log in.';register.reset();}
   else{const data=await request('/api/auth/login',{method:'POST',body:JSON.stringify(values)});session=data;verified=true;verificationError='';sessionStorage.setItem('story.session',JSON.stringify(data));form.reset();updateNav();dialog.close();if(data.user.role==='admin')location.href='admin.html';}
  }catch(error){message.textContent=error.message;}finally{submit.disabled=false;}
 });
 async function refresh(){
  verified=false;verificationError='';
  if(!session?.token){updateNav();return null;}
  try{const data=await request('/api/auth/me');session.user=data.user;verified=true;sessionStorage.setItem('story.session',JSON.stringify(session));updateNav();return session.user;}
  catch(error){verificationError=error.message;updateNav();throw error;}
 }
 dialog.querySelector('#auth-retry').onclick=async()=>{const button=dialog.querySelector('#auth-retry');button.disabled=true;message.textContent='Verifying…';try{const user=await refresh();if(user){message.textContent='';showAccount();if(user.role==='admin'&&!location.pathname.endsWith('admin.html'))location.href='admin.html';}else mode('login');}catch(error){message.textContent=error.message;button.hidden=!session?.token;}finally{button.disabled=false;}};
 const ready=refresh().catch(()=>null);
 window.SiteAuth={ready,refresh,request,getUser:()=>verified?session?.user||null:null,logout};document.addEventListener('site:ready',updateNav);
})();
