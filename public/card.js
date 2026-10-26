(() => {
  'use strict';
  const badge = document.querySelector('#badge');
  const toggle = document.querySelector('#motion-toggle');
  const motionState = document.querySelector('#motion-state');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let frame = 0;
  let point = null;
  let rect = null;
  let qrVisible = false;
  let flipping = false;
  let foil = { angle: 0, separation: 100, second: 0, bend: 0 };

  function newFoil() {
    // Randomness is sampled per handling, never per frame: movement stays continuous.
    foil = { angle: Math.random() * 360, separation: 18 + Math.random() * 210, second: Math.random() < .7 ? 1 : 0, bend: 10 + Math.random() * 18 };
  }

  function resetTilt() {
    cancelAnimationFrame(frame);
    frame = 0;
    point = null;
    badge.classList.remove('is-tracking');
    ['--rx', '--ry'].forEach(key => badge.style.removeProperty(key));
  }
  function motionAllowed() {
    return toggle.checked && !reducedMotion.matches && finePointer.matches && !qrVisible && !flipping;
  }
  function syncMotion() {
    resetTilt();
    const allowed = motionAllowed();
    document.body.classList.toggle('motion-off', !allowed);
    document.dispatchEvent(new CustomEvent('card-motion-change', { detail: { allowed } }));
    motionState.textContent = allowed ? 'Enabled with mouse' : reducedMotion.matches ? 'Reduced motion enabled' : !finePointer.matches ? 'Static on this device' : 'Disabled';
  }
  toggle.addEventListener('change', syncMotion);
  reducedMotion.addEventListener('change', syncMotion);
  finePointer.addEventListener('change', syncMotion);
  syncMotion();
  badge.addEventListener('pointerenter', () => { rect = badge.getBoundingClientRect(); newFoil(); });
  badge.addEventListener('pointermove', event => {
    if (!motionAllowed() || event.pointerType !== 'mouse' || document.activeElement.matches(':focus-visible')) return;
    point = { x: event.clientX, y: event.clientY };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!point || !motionAllowed()) return;
      rect ??= badge.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, ((point.x - rect.left) / rect.width - .5) * 2));
      const y = Math.max(-1, Math.min(1, ((point.y - rect.top) / rect.height - .5) * 2));
      badge.classList.add('is-tracking');
      badge.style.setProperty('--rx', `${-y * 3.5}deg`);
      badge.style.setProperty('--ry', `${x * 4}deg`);
      badge.style.setProperty('--glare-x', `${(x + 1) * 50}%`);
      badge.style.setProperty('--glare-y', `${(y + 1) * 50}%`);
      badge.style.setProperty('--glare-angle', `${115 + x * 18 - y * 12}deg`);
      const angle = foil.angle + x * 112 + y * 84;
      badge.style.setProperty('--foil-angle', `${angle}deg`);
      badge.style.setProperty('--foil-angle-two', `${angle + foil.separation + Math.sin(x * 2 + y) * foil.bend}deg`);
      badge.style.setProperty('--foil-second', String(foil.second));
    });
  });
  badge.addEventListener('pointerleave', resetTilt);
  badge.addEventListener('pointercancel', resetTilt);
  document.addEventListener('focusin', resetTilt);
  document.addEventListener('visibilitychange', resetTilt);
  window.addEventListener('resize', () => { rect = null; resetTilt(); });
  window.addEventListener('scroll', () => { rect = null; resetTilt(); }, { passive: true });
  window.addEventListener('blur', resetTilt);

  document.body.classList.add('js-ready');
  const front = document.getElementById('card-front');
  const back = document.getElementById('card-back');
  const qrButton = document.querySelector('[data-flip="back"]');
  async function flip(show) {
    if (!back || flipping || qrVisible === show || document.querySelector('dialog[open]')) return;
    flipping = true;
    resetTilt();
    badge.classList.add('is-flipping');
    if (show) back.style.minHeight = `${front.offsetHeight}px`;
    const animate = !reducedMotion.matches && toggle.checked && typeof badge.animate === 'function';
    try {
      if (animate) await badge.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(90deg)' }], { duration: 140, easing: 'ease-in' }).finished;
      front.hidden = show;
      back.hidden = !show;
      qrVisible = show;
      qrButton.setAttribute('aria-expanded', String(show));
      badge.setAttribute('aria-labelledby', show ? 'qr-title' : 'person-name');
      badge.classList.toggle('is-qr', show);
      (show ? back.querySelector('h2') : qrButton).focus({ preventScroll: true });
      if (animate) await badge.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0deg)' }], { duration: 180, easing: 'ease-out' }).finished;
    } finally {
      flipping = false;
      badge.classList.remove('is-flipping');
    }
  }
  document.querySelectorAll('[data-flip]').forEach(button => button.addEventListener('click', () => flip(button.dataset.flip === 'back')));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && qrVisible && !document.querySelector('dialog[open]')) { event.preventDefault(); flip(false); }
  });
  // A deliberate tap on free space is a shortcut; scrolling, selecting text and controls retain their behavior.
  let tap = null;
  const interactive = 'a,button,input,label,textarea,select,summary,img,[contenteditable="true"]';
  badge.addEventListener('pointerdown', event => {
    tap = event.button === 0 && !event.target.closest(interactive) ? { x: event.clientX, y: event.clientY, scroll: window.scrollY } : null;
  });
  badge.addEventListener('pointercancel', () => { tap = null; });
  badge.addEventListener('click', event => {
    const start = tap; tap = null;
    if (!start || event.target.closest(interactive) || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8 || window.scrollY !== start.scroll || !window.getSelection().isCollapsed) return;
    flip(!qrVisible);
  });
  document.querySelector('[data-qr-logo]')?.addEventListener('change', event => {
    const image = back.querySelector('[data-qr-image]'), url = new URL(image.src);
    url.searchParams.set('logo', event.target.checked ? '1' : '0');
    image.src = url.href;
  });
  const openers = new WeakMap();
  function open(dialog, opener) {
    const previous=document.querySelector('dialog[open]');
    if(previous) { opener=openers.get(previous)||opener; previous.close(); }
    resetTilt(); openers.set(dialog,opener); dialog.showModal(); dialog.querySelector('h2').focus();
  }
  document.querySelectorAll('[data-dialog]').forEach(b=>b.addEventListener('click',()=>open(document.getElementById(b.dataset.dialog),b)));
  document.querySelectorAll('[data-info]').forEach(b=>b.addEventListener('click',()=>open(document.getElementById('info-dialog'),b)));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>{ if(!document.querySelector('dialog[open]')) openers.get(d)?.focus(); }));
  document.querySelectorAll('[data-inquiry]').forEach(form=>form.addEventListener('submit',e=>{
    const email=form.elements.email,phone=form.elements.phone;
    if(phone&&!email.value.trim()&&!phone.value.trim()){ e.preventDefault(); form.querySelector('[role=status]').textContent='Enter an email address or phone number.'; email.focus(); return; }
    form.querySelector('button[type=submit]').disabled=true; form.querySelector('[role=status]').textContent='Sending…';
  }));
  document.getElementById('copy-contact')?.addEventListener('click',async()=>{
    const field=document.getElementById('contact-data');
    try { await navigator.clipboard.writeText(field.value); document.getElementById('copy-status').textContent='Details copied.'; }
    catch{document.getElementById('copy-fallback').hidden=false;field.focus();field.select();}
  });
  document.querySelector('[data-share-url]')?.addEventListener('click',async e=>{
    const url=e.currentTarget.dataset.shareUrl;
    try{ if(navigator.share) await navigator.share({title:document.title,url}); else {await navigator.clipboard.writeText(url);document.getElementById('share-status').textContent='Link copied.';} }
    catch(error){if(error.name!=='AbortError')document.getElementById('share-status').textContent='Copy the link from your browser’s address bar.';}
  });
  document.querySelectorAll('[data-external]').forEach(a=>a.addEventListener('click',()=>document.querySelector('[data-dialog="callback-dialog"]')?.classList.add('attention')));
})();
