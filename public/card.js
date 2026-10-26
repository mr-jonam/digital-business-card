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
    return toggle.checked && !reducedMotion.matches && finePointer.matches;
  }
  function syncMotion() {
    resetTilt();
    const allowed = motionAllowed();
    document.body.classList.toggle('motion-off', !allowed);
    document.dispatchEvent(new CustomEvent('card-motion-change', { detail: { allowed } }));
    motionState.textContent = allowed ? 'Attivi con il mouse' : reducedMotion.matches ? 'Movimento ridotto rispettato' : !finePointer.matches ? 'Statici su questo dispositivo' : 'Disattivati';
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
    if(phone&&!email.value.trim()&&!phone.value.trim()){ e.preventDefault(); form.querySelector('[role=status]').textContent='Inserisci almeno un recapito: email o telefono.'; email.focus(); return; }
    form.querySelector('button[type=submit]').disabled=true; form.querySelector('[role=status]').textContent='Invio in corso…';
  }));
  document.getElementById('copy-contact')?.addEventListener('click',async()=>{
    const field=document.getElementById('contact-data');
    try { await navigator.clipboard.writeText(field.value); document.getElementById('copy-status').textContent='Dati copiati.'; }
    catch{document.getElementById('copy-fallback').hidden=false;field.focus();field.select();}
  });
  document.querySelector('[data-share-url]')?.addEventListener('click',async e=>{
    const url=e.currentTarget.dataset.shareUrl;
    try{ if(navigator.share) await navigator.share({title:document.title,url}); else {await navigator.clipboard.writeText(url);document.getElementById('share-status').textContent='Link copiato.';} }
    catch(error){if(error.name!=='AbortError')document.getElementById('share-status').textContent='Copia il link dalla barra del browser.';}
  });
  document.querySelectorAll('[data-external]').forEach(a=>a.addEventListener('click',()=>document.querySelector('[data-dialog="callback-dialog"]')?.classList.add('attention')));
})();
