(() => {
 let session=null;
 try{session=JSON.parse(sessionStorage.getItem('story.session'));}catch{sessionStorage.removeItem('story.session');}
 const isLocal=['localhost','127.0.0.1'].includes(location.hostname);
 async function request(path,options={}){
  const base=window.APP_CONFIG?.apiBase||'';
  if(!isLocal&&!base)throw new Error('尚未配置 Cloudflare 身份认证地址');
  const response=await fetch(base+path,{...options,headers:{'Content-Type':'application/json',...(session?.token?{Authorization:'Bearer '+session.token}:{}),...options.headers}});
  const data=await response.json();
  if(!response.ok){if(response.status===401){session=null;sessionStorage.removeItem('story.session');updateNav();}throw Object.assign(new Error(data.error||'请求失败'),{status:response.status});}
  return data;
 }
 function updateNav(){if(new URLSearchParams(location.search).has('editor'))return;document.querySelectorAll('a[href="#login"]').forEach(a=>{if(!a.dataset.authLabel)a.dataset.authLabel=a.textContent||'登录';a.textContent=session?.user?.username||a.dataset.authLabel;});}
 const dialog=document.createElement('dialog');dialog.id='auth-dialog';dialog.className='auth-dialog';
 dialog.innerHTML=`<div class="auth-heading"><h2 id="auth-title">登录</h2><button type="button" class="auth-close" aria-label="关闭登录窗口">×</button></div>
 <div class="auth-tabs"><button type="button" data-mode="login">登录</button><button type="button" data-mode="register">注册</button></div>
 <form id="auth-login"><label>用户名或邮箱<input name="identifier" autocomplete="username" required maxlength="254"></label><label>密码<input name="password" type="password" autocomplete="current-password" required minlength="10" maxlength="128"></label><button class="auth-submit">登录</button></form>
 <form id="auth-register" hidden><label>用户名<input name="username" autocomplete="username" required minlength="2" maxlength="32"></label><label>邮箱<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>密码（至少 10 位）<input name="password" type="password" autocomplete="new-password" required minlength="10" maxlength="128"></label><label>确认密码<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="10" maxlength="128"></label><button class="auth-submit">注册</button></form>
 <div id="auth-account" hidden><p id="auth-account-name"></p><a id="auth-admin-link" href="admin.html">进入管理员控制界面</a><button type="button" id="auth-logout">退出登录</button></div><p id="auth-message" role="status" aria-live="polite"></p>`;
 dialog.setAttribute('aria-labelledby','auth-title');document.body.append(dialog);
 const login=dialog.querySelector('#auth-login'),register=dialog.querySelector('#auth-register'),account=dialog.querySelector('#auth-account'),message=dialog.querySelector('#auth-message');
 function mode(name){login.hidden=name!=='login';register.hidden=name!=='register';account.hidden=true;dialog.querySelector('.auth-tabs').hidden=false;dialog.querySelector('#auth-title').textContent=name==='login'?'登录':'注册';message.textContent='';}
 function open(){if(session?.user){login.hidden=register.hidden=true;account.hidden=false;dialog.querySelector('.auth-tabs').hidden=true;dialog.querySelector('#auth-title').textContent='账户';dialog.querySelector('#auth-account-name').textContent=session.user.username+' · '+session.user.role;dialog.querySelector('#auth-admin-link').hidden=session.user.role!=='admin';}else mode('login');dialog.showModal();}
 dialog.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>mode(button.dataset.mode)));
 dialog.querySelector('.auth-close').onclick=()=>dialog.close();
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 document.addEventListener('click',e=>{const link=e.target.closest('a[href="#login"]');if(!link)return;if(new URLSearchParams(location.search).has('editor'))return;e.preventDefault();open();});
 async function logout(){await request('/api/auth/logout',{method:'POST'});session=null;sessionStorage.removeItem('story.session');updateNav();dialog.close();if(location.pathname.endsWith('admin.html'))location.href='index.html';}
 dialog.querySelector('#auth-logout').onclick=()=>logout().catch(e=>message.textContent=e.message);
 for(const form of [login,register])form.addEventListener('submit',async e=>{
  e.preventDefault();const values=Object.fromEntries(new FormData(form));
  if(form===register&&values.password!==values.confirmPassword){message.textContent='两次输入的密码不一致';return;}
  const submit=form.querySelector('button');submit.disabled=true;message.textContent='正在提交…';
  try{
   if(form===register){delete values.confirmPassword;await request('/api/auth/register',{method:'POST',body:JSON.stringify(values)});mode('login');login.elements.identifier.value=values.email;message.textContent='注册成功，请登录。';register.reset();}
   else{const data=await request('/api/auth/login',{method:'POST',body:JSON.stringify(values)});session=data;sessionStorage.setItem('story.session',JSON.stringify(data));form.reset();updateNav();dialog.close();if(data.user.role==='admin')location.href='admin.html';}
  }catch(error){message.textContent=error.message;}finally{submit.disabled=false;}
 });
 const ready=(async()=>{if(session?.token){try{session.user=(await request('/api/auth/me')).user;sessionStorage.setItem('story.session',JSON.stringify(session));}catch{session=null;sessionStorage.removeItem('story.session');}}updateNav();})();
 window.SiteAuth={ready,request,getUser:()=>session?.user||null,logout};document.addEventListener('site:ready',updateNav);
})();
