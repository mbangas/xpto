/* back-to-top.js — injects a scroll-to-top button on all main pages */
(function () {
  'use strict';

  // arvore.html uses body.page-tree with overflow:hidden on .content — skip it
  if (document.body.classList.contains('page-tree')) return;

  var content = document.querySelector('main.content');
  if (!content) return;

  var btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.id = 'back-to-top';
  btn.title = 'Subir ao topo';
  btn.setAttribute('aria-label', 'Subir ao topo');
  btn.innerHTML = '<i class="mdi mdi-chevron-up" aria-hidden="true"></i>';
  document.body.appendChild(btn);

  function onScroll() {
    var y = window.scrollY || window.pageYOffset || content.scrollTop || 0;
    if (y > 200) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  content.addEventListener('scroll', onScroll, { passive: true });

  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    content.scrollTo({ top: 0, behavior: 'smooth' });
  });
}());
