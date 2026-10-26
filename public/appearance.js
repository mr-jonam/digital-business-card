/* Original contrast-safe theme resolver. */
(() => {
  'use strict';
  const themes = Object.freeze({
    petrol: { surface: '#062e35', accent: '#df0030' },
    graphite: { surface: '#191e24', accent: '#df0030' },
    midnight: { surface: '#101e38', accent: '#3c71db' },
    forest: { surface: '#122e27', accent: '#bd692c' }
  });
  const arts = ['qa-platforms', 'none', 'qa-flow', 'coverage'];
  const finishes = ['holo', 'spotlight', 'plain'];
  const backdrops = ['qa-grid', 'grid', 'plain'];
  const hex = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  const rgb = color => color.slice(1).match(/../g).map(part => parseInt(part, 16));
  const color = channels => '#' + channels.map(value => Math.round(value).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, amount) => color(rgb(a).map((value, index) => value * (1 - amount) + rgb(b)[index] * amount));
  function luminance(value) {
    const channels = rgb(value).map(channel => {
      const s = channel / 255;
      return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
    });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  }
  function contrast(a, b) {
    const first = luminance(a);
    const second = luminance(b);
    return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
  }
  function darkenUntil(value, predicate) {
    for (let attempts = 0; !predicate(value) && attempts < 100; attempts++) value = mix(value, '#000000', .05);
    return value;
  }
  function resolve(input = {}) {
    const theme = Object.hasOwn(themes, input.theme) ? input.theme : 'graphite';
    const art = arts.includes(input.art) ? input.art : 'qa-platforms';
    const finish = finishes.includes(input.finish) ? input.finish : 'holo';
    const backdrop = backdrops.includes(input.backdrop) ? input.backdrop : 'qa-grid';
    const requestedSurface = hex(input.surface) ? input.surface.toLowerCase() : themes[theme].surface;
    const requestedAccent = hex(input.accent) ? input.accent.toLowerCase() : themes[theme].accent;
    // Includes a conservative 18% white blend: art, hover, press and CTA sheen.
    // Text colors, overlay strength and state blends must stay within these bounds.
    const surface = darkenUntil(requestedSurface, value => contrast('#b8cccb', mix(value, '#ffffff', .18)) >= 4.8);
    const accent = darkenUntil(requestedAccent, value => contrast('#ffffff', value) >= 4.7);
    return Object.freeze({ theme, art, finish, backdrop, requestedSurface, requestedAccent, surface, accent,
      adjusted: surface !== requestedSurface || accent !== requestedAccent,
      textContrast: contrast('#b8cccb', mix(surface, '#ffffff', .18)),
      buttonContrast: contrast('#ffffff', accent) });
  }
  function apply(appearance) {
    const variables = {
      '--surface-dark': appearance.surface,
      '--brand-red': appearance.accent,
      '--primary-hover': mix(appearance.accent, '#000000', .12),
      '--metal-dark': mix(appearance.accent, '#000000', .5),
      '--metal-base': appearance.accent,
      '--metal-light': mix(appearance.accent, '#ffffff', .1),
      '--card-link': mix(appearance.surface, '#ffffff', .06),
      '--card-link-hover': mix(appearance.surface, '#ffffff', .1),
      '--card-link-active': mix(appearance.surface, '#ffffff', .14)
    };
    Object.entries(variables).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
    document.body.dataset.art = appearance.art;
    document.body.dataset.theme = appearance.theme;
    document.body.dataset.finish = appearance.finish;
    document.body.dataset.backdrop = appearance.backdrop;
  }
  function query(appearance) {
    const params = new URLSearchParams({ theme: appearance.theme, art: appearance.art, finish: appearance.finish, backdrop: appearance.backdrop });
    if (appearance.requestedSurface !== themes[appearance.theme].surface) params.set('surface', appearance.requestedSurface);
    if (appearance.requestedAccent !== themes[appearance.theme].accent) params.set('accent', appearance.requestedAccent);
    return params.toString();
  }
  window.CardAppearance = Object.freeze({ resolve, apply, query, themes, contrast });
  if (document.querySelector('#badge')) apply(resolve(JSON.parse(document.querySelector('#badge').dataset.appearance || '{}')));
})();
