(() => {
  let currentSite, controller, observer, library = [], rotation;
  const roots = [...document.querySelectorAll('title, .skip, .site-header, main, .site-footer, #video-dialog')];
  const originals = roots.map(node => node.innerHTML);
  const get = (data, path) => path.split('.').reduce((value, key) => value[key], data);
  function safeUrl(source) {
    if (!source) return '';
    const url = new URL(source, document.baseURI);
    if (!['http:', 'https:'].includes(url.protocol) && !/^data:image\//i.test(source)) {
      throw new Error('Unsupported image or link protocol');
    }
    return url.href;
  }
  function renderContent(site) {
    document.querySelectorAll('template[data-site-each]').forEach(template => {
      const path = template.dataset.siteEach;
      get(site, path).forEach((card, index) => {
        const fragment = template.content.cloneNode(true);
        const media = fragment.querySelector('.media');
        if (index % 3) media.classList.add('media-' + (index % 3 + 1));
        fragment.querySelectorAll('*').forEach(node => {
          [...node.attributes].filter(attr => attr.name.startsWith('data-site-')).forEach(attr => {
            node.setAttribute(attr.name, attr.value.replaceAll(path + '.0', path + '.' + index));
          });
        });
        template.before(fragment);
      });
      template.remove();
    });
    document.querySelectorAll('[data-site-text], [data-site-lines]').forEach(node => {
      const path = node.dataset.siteText || node.dataset.siteLines;
      const value = get(site, path);
      if ((Array.isArray(value) ? value : [value]).every(line => !String(line).trim())) { node.remove(); return; }
      const fragment = document.createDocumentFragment();
      (Array.isArray(value) ? value : [value]).forEach((line, index) => {
        if (index) fragment.append(document.createElement('br'));
        fragment.append(document.createTextNode(line));
      });
      if (node.dataset.siteTextPosition === 'after') node.append(fragment);
      else node.prepend(fragment);
    });
    document.querySelectorAll('[data-site-attrs]').forEach(node => {
      Object.entries(JSON.parse(node.dataset.siteAttrs)).forEach(([name, path]) => {
        const value = get(site, path);
        if (name === 'href') safeUrl(value);
        node.setAttribute(name, value);
      });
    });
    const mask = safeUrl(site.sections.intro.maskImage.src);
    document.documentElement.style.setProperty('--intro-mask', mask ? `url(${JSON.stringify(mask)})` : 'none');
    document.querySelectorAll('[data-site-image]').forEach(photo => {
      let image = get(site, photo.dataset.siteImage);
      if (!image.src && photo.dataset.siteImageFallback) image = get(site, photo.dataset.siteImageFallback);
      const parent = photo.parentElement;
      photo.alt = image.alt;
      const loaded = () => { photo.hidden = false; parent.classList.add('photo-loaded'); };
      photo.addEventListener('load', loaded);
      photo.addEventListener('error', () => { parent.classList.remove('photo-loaded'); photo.hidden = true; });
      const source = safeUrl(image.src);
      if (source) { photo.src = source; if (photo.complete && photo.naturalWidth > 0) loaded(); }
      else photo.hidden = true;
    });
    const media=site.sections.hero.media;
    if(media&&media.type!=='image'&&media.src){
      const stage=document.querySelector('.hero-image');let player;
      if(media.type==='video'){
        player=document.createElement('video');player.muted=true;player.defaultMuted=true;player.autoplay=true;player.loop=true;player.playsInline=true;player.preload='metadata';player.poster=safeUrl(site.sections.hero.image.src);player.src=safeUrl(media.src);
      }else if(media.type==='vimeo'){
        const source=new URL(media.src,document.baseURI);const match=['vimeo.com','www.vimeo.com'].includes(source.hostname)?source.pathname.match(/^\/(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/)||source.pathname.match(/^\/reviews\/[a-zA-Z0-9-]+\/videos\/(\d+)\/?$/):source.hostname==='player.vimeo.com'?source.pathname.match(/^\/video\/(\d+)\/?$/):null;
        if(source.protocol==='https:'&&match){const url=new URL('https://player.vimeo.com/video/'+match[1]);const hash=source.searchParams.get('h')||match[2];if(hash&&/^[a-zA-Z0-9]+$/.test(hash))url.searchParams.set('h',hash);for(const key of ['autoplay','muted','loop','background'])url.searchParams.set(key,'1');player=document.createElement('iframe');player.src=url.href;player.title='Hero background video';player.allow='autoplay; fullscreen; picture-in-picture';player.tabIndex=-1;player.referrerPolicy='strict-origin-when-cross-origin';}
      }
      if(player){player.className='hero-motion';stage.append(player);}
    }
  }
  async function initialize() {
    const response = await fetch('site.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`site.json: HTTP ${response.status}`);
    const videosResponse = await fetch('videos.json', {cache:'no-store'});
    if (!videosResponse.ok) throw new Error('Unable to load video library');
    library = (await window.SiteResponses.readJson(videosResponse,'Video library')).videos;
    render(await window.SiteResponses.readJson(response,'Homepage content'));
  }
  function renderVideos(on) {
    const $=id=>document.getElementById(id), link=v=>'video.html?id='+encodeURIComponent(v.id);
    const photo=(node,v)=>{node.alt=v.cover.alt||v.title;node.onload=()=>node.parentElement.classList.add('photo-loaded');node.onerror=()=>{node.hidden=true;node.parentElement.classList.remove('photo-loaded');};node.hidden=false;node.src=v.cover.src;};
    $('moments-empty').hidden=$('videos-empty').hidden=library.length>0;
    $('moments-content').hidden=$('archive-stage').hidden=library.length===0;
    $('moment-background').hidden=library.length===0;
    if(!library.length)return;
    const rail=$('video-rail');
    library.forEach(v=>{const article=document.createElement('article');article.className='rail-card';const cover=document.createElement('a');cover.className='media';cover.href=link(v);cover.setAttribute('aria-label',v.title);const image=document.createElement('img');image.className='sample-photo';image.loading='lazy';image.referrerPolicy='no-referrer';cover.append(image);photo(image,v);const play=document.createElement('span');play.className='play';play.textContent='▶';play.setAttribute('aria-hidden','true');cover.append(play);const title=document.createElement('h3');title.textContent=v.title;const description=document.createElement('p');description.textContent=v.description;article.append(cover,title,description);rail.append(article);});
    const update=()=>{$('previous').disabled=rail.scrollLeft<2;$('next').disabled=rail.scrollLeft>=rail.scrollWidth-rail.clientWidth-2;};
    for(const [id,direction] of [['previous',-1],['next',1]])on($(id),'click',()=>rail.scrollBy({left:direction*(rail.querySelector('.rail-card').offsetWidth+24),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
    on(rail,'scroll',update,{passive:true});observer=new ResizeObserver(update);observer.observe(rail);update();
    let index=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
    function show(){const current=library[index],next=library[(index+1)%library.length];$('moment-title').textContent=current.title;$('moment-tags').replaceChildren(...current.tags.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));$('moment-link').href=$('moment-cover-link').href=link(current);photo($('moment-cover'),current);photo($('moment-background'),current);photo($('moment-next-cover'),next);$('moment-next-title').textContent=next.title;$('moment-next').hidden=library.length<2;$('moment-pause').hidden=library.length<2;$('moment-position').textContent=(index+1)+' / '+library.length;$('moment-pause').textContent=paused?'Resume rotation':'Pause rotation';$('moment-pause').setAttribute('aria-pressed',String(paused));}
    function schedule(){clearInterval(rotation);if(library.length>1&&!paused)rotation=setInterval(()=>{const area=$('moments-content');if(!document.hidden&&!area.matches(':hover')&&!area.contains(document.activeElement)){index=(index+1)%library.length;show();}},8000);}
    on($('moment-next'),'click',()=>{index=(index+1)%library.length;show();schedule();});on($('moment-pause'),'click',()=>{paused=!paused;show();schedule();});show();schedule();
  }
  function render(site) {
    currentSite = structuredClone(site);
    controller?.abort(); observer?.disconnect(); clearInterval(rotation);
    controller = new AbortController();
    const on = (node, event, handler, options = {}) => node.addEventListener(event, handler, {...options, signal: controller.signal});
    roots.forEach((node, index) => node.innerHTML = originals[index]);
    const links = document.querySelector('.nav-links');
    const linkNodes = [...links.children];
    links.replaceChildren(...site.header.links.map((link, index) => {
      const node = linkNodes[Math.min(index, 3)].cloneNode(true);
      node.dataset.siteText = 'header.links.' + index + '.label';
      node.dataset.siteAttrs = JSON.stringify({href: 'header.links.' + index + '.href'});
      return node;
    }));
    renderContent(site);
    renderVideos(on);
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    function closeMenu() { navLinks.classList.remove('open'); menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.setAttribute('aria-label', site.header.menu.openLabel); }
    on(menuToggle, 'click', () => {
      const open = navLinks.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? site.header.menu.closeLabel : site.header.menu.openLabel);
    });
    navLinks.querySelectorAll('a').forEach(link => on(link, 'click', closeMenu));
    on(document, 'keydown', event => { if (event.key === 'Escape') closeMenu(); });
    on(matchMedia('(min-width:769px)'), 'change', event => { if (event.matches) closeMenu(); });
    document.documentElement.dataset.siteReady = 'true';
    document.dispatchEvent(new CustomEvent('site:ready'));
  }
  window.SitePage = {getSite: () => structuredClone(currentSite), render};
  initialize().catch(error => {
    document.documentElement.dataset.siteReady = 'error';
    console.error('Unable to load site content. Serve this directory over HTTP.', error);
  });
})();
