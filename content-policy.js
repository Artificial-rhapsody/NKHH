(() => {
 const roots=['videoLibrary','sections.videos.cards','sections.layouts.mainCard','sections.layouts.sideCard','videoDialog'];
 window.SiteContentPolicy={isVideoManaged:path=>roots.some(root=>path===root||path.startsWith(root+'.'))};
})();
