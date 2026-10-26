/* Original, restrained Dot Grid interpretation. No ReactBits code or dependencies. */
(() => {
  'use strict';
  const canvas = document.querySelector('.ambient-grid canvas');
  const context = canvas?.getContext('2d');
  if (!context) return; // CSS dots remain visible without a canvas context.
  const toggle = document.querySelector('#motion-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const forced = matchMedia('(forced-colors: active)');
  let width = 0;
  let height = 0;
  let dots = [];
  let pointer = null;
  let frame = 0;
  function allowed() {
    return toggle.checked && fine.matches && !reduced.matches && !forced.matches &&
      !document.hidden && document.body.dataset.backdrop !== 'plain' &&
      !document.querySelector('dialog[open], :focus-visible');
  }
  function draw() {
    frame = 0;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#f2f5f4';
    context.fillRect(0, 0, width, height);
    let settling = false;
    const active = allowed() ? pointer : null;
    for (const dot of dots) {
      const dx = active ? dot.x - active.x : 0;
      const dy = active ? dot.y - active.y : 0;
      const distance = Math.hypot(dx, dy);
      const strength = active ? Math.max(0, 1 - distance / 145) : 0;
      const targetX = distance ? dx / distance * strength * 5 : 0;
      const targetY = distance ? dy / distance * strength * 5 : 0;
      dot.dx += (targetX - dot.dx) * .22;
      dot.dy += (targetY - dot.dy) * .22;
      dot.light += (strength - dot.light) * .22;
      if (Math.abs(targetX - dot.dx) + Math.abs(targetY - dot.dy) + Math.abs(strength - dot.light) > .025) settling = true;
      context.fillStyle = `rgba(0,65,73,${.13 + dot.light * .28})`;
      context.beginPath();
      context.arc(dot.x + dot.dx, dot.y + dot.dy, 1 + dot.light * .65, 0, Math.PI * 2);
      context.fill();
    }
    if (settling && allowed()) frame = requestAnimationFrame(draw);
  }
  function requestDraw() {
    if (!frame) frame = requestAnimationFrame(draw);
  }
  function reset() {
    pointer = null;
    cancelAnimationFrame(frame);
    frame = 0;
    if (!allowed()) dots.forEach(dot => { dot.dx = 0; dot.dy = 0; dot.light = 0; });
    draw();
  }
  function resize() {
    cancelAnimationFrame(frame);
    frame = 0;
    width = innerWidth;
    height = innerHeight;
    // Bounded pixel budget and dot count, including large desktop displays.
    const ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(4000000 / (width * height)));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const gap = Math.max(32, Math.ceil(Math.sqrt(width * height / 1000)));
    dots = [];
    for (let y = 16; y < height; y += gap) {
      for (let x = 16; x < width; x += gap) dots.push({ x, y, dx: 0, dy: 0, light: 0 });
    }
    reset();
  }
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !allowed()) return;
    pointer = { x: event.clientX, y: event.clientY };
    requestDraw();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', reset);
  document.addEventListener('pointercancel', reset);
  document.addEventListener('focusin', reset);
  document.addEventListener('card-motion-change', reset);
  document.addEventListener('visibilitychange', reset);
  document.addEventListener('toggle', reset, true);
  window.addEventListener('blur', reset);
  window.addEventListener('scroll', reset, { passive: true });
  window.addEventListener('resize', resize);
  forced.addEventListener('change', reset);
  resize();
})();
