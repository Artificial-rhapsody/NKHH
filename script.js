(() => {
  let currentSite, controller, observer;
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
  }
  async function initialize() {
    const response = await fetch('site.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`site.json: HTTP ${response.status}`);
    render(await response.json());
  }
  function render(site) {
    currentSite = structuredClone(site);
    controller?.abort(); observer?.disconnect();
    controller = new AbortController();
    const on = (node, event, handler, options = {}) => node.addEventListener(event, handler, {...options, signal: controller.signal});
    roots.forEach((node, index) => node.innerHTML = originals[index]);
    const thanks = document.querySelector('.credits');
    const credits = [...thanks.children];
    thanks.replaceChildren(...site.sections.thanks.names.map((name, index) => {
      const node = credits[index % credits.length].cloneNode(true);
      node.dataset.siteText = 'sections.thanks.names.' + index;
      if (index >= credits.length) {
        node.style.setProperty('--x', (10 + (index % 5) * 18) + '%');
        node.style.setProperty('--y', (12 + Math.floor(index / 5) * 15) + '%');
      }
      return node;
    }));
    const links = document.querySelector('.nav-links');
    const linkNodes = [...links.children];
    links.replaceChildren(...site.header.links.map((link, index) => {
      const node = linkNodes[Math.min(index, 3)].cloneNode(true);
      node.dataset.siteText = 'header.links.' + index + '.label';
      node.dataset.siteAttrs = JSON.stringify({href: 'header.links.' + index + '.href'});
      return node;
    }));
    renderContent(site);
    const rail = document.querySelector('.rail');
    const previous = document.querySelector('#previous');
    const next = document.querySelector('#next');
    const dotContainer = document.querySelector('.dots');
    const dotPrototype = dotContainer.querySelector('.dot').cloneNode(true);
    dotContainer.replaceChildren(...site.sections.videos.cards.map(() => dotPrototype.cloneNode(true)));
    const dots = [...dotContainer.children];
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const behavior = () => reduceMotion.matches ? 'instant' : 'smooth';
    function updateRail() {
      const media = rail.querySelector('.media');
      if (!media) { previous.disabled = next.disabled = true; return; }
      rail.parentElement.style.setProperty('--media-center', `${media.offsetTop + media.offsetHeight / 2}px`);
      const max = rail.scrollWidth - rail.clientWidth;
      previous.disabled = rail.scrollLeft < 2;
      next.disabled = rail.scrollLeft >= max - 2;
      const progress = max > 0 ? rail.scrollLeft / max : 0;
      dots.forEach((dot, index) => dot.classList.toggle('active', index === Math.round(progress * (dots.length - 1))));
    }
    function moveRail(direction) {
      const card = rail.querySelector('.rail-card');
      if (!card) return;
      const gap = parseFloat(getComputedStyle(rail).gap) || 24;
      rail.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: behavior() });
    }
    on(previous, 'click', () => moveRail(-1));
    on(next, 'click', () => moveRail(1));
    on(rail, 'scroll', updateRail, { passive: true });
    on(rail, 'keydown', event => {
      if (event.target !== rail || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); moveRail(event.key === 'ArrowRight' ? 1 : -1);
    });
    observer = new ResizeObserver(updateRail); observer.observe(rail);
    updateRail();
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
    const dialog = document.querySelector('#video-dialog');
    let opener;
    document.querySelectorAll('[data-video]').forEach(button => on(button, 'click', () => {
      opener = button;
      const card = get(site, button.dataset.siteCard);
      document.querySelector('#dialog-title').textContent = card.preview.title;
      document.querySelector('#preview-label').textContent = card.preview.label;
      dialog.showModal(); document.body.classList.add('modal-open');
    }));
    on(document.querySelector('.dialog-close'), 'click', () => dialog.close());
    on(dialog, 'click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    on(dialog, 'close', () => { document.body.classList.remove('modal-open'); if (opener) opener.focus({ preventScroll: true }); });
    document.documentElement.dataset.siteReady = 'true';
    document.dispatchEvent(new CustomEvent('site:ready'));
  }
  window.SitePage = {getSite: () => structuredClone(currentSite), render};
  initialize().catch(error => {
    document.documentElement.dataset.siteReady = 'error';
    console.error('Unable to load site content. Serve this directory over HTTP.', error);
  });
})();
