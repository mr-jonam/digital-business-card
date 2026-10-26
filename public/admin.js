(() => {
  'use strict';
  document.querySelectorAll('[data-confirm]').forEach(form => form.addEventListener('submit', event => {
    if (!confirm(form.dataset.confirm)) event.preventDefault();
  }));
  const list = document.getElementById('links-list');
  list?.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-link]');
    if (!button) return;
    if (list.children.length === 1) {
      button.closest('.link-row').querySelectorAll('input').forEach(field => { field.value = ''; });
      list.querySelector('input').focus();
    } else { button.closest('.link-row').remove(); document.getElementById('add-link').focus(); }
  });
  document.getElementById('add-link')?.addEventListener('click', () => {
    if (list.children.length >= 12) return;
    const row = list.firstElementChild.cloneNode(true);
    row.querySelectorAll('input').forEach(field => { field.value = ''; });
    row.querySelector('select').value = 'site';
    list.append(row); row.querySelector('input').focus();
  });
  document.getElementById('photo-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget, status = document.getElementById('photo-status'), button = form.querySelector('button');
    button.disabled = true; status.textContent = 'Uploading…';
    try {
      const response = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'x-csrf-token': form.dataset.csrf } });
      if (!response.ok) { status.textContent = response.status === 409 ? 'The draft has changed. Reload the page.' : 'Photo not uploaded. Check the format (PNG, JPEG, WebP) and size (2 MB, 16 megapixels).'; return; }
      location.reload();
    } catch { status.textContent = 'Connection interrupted. Please try again.'; }
    finally { button.disabled = false; }
  });
  document.querySelector('[data-copy]')?.addEventListener('click', async event => {
    const field = document.querySelector(event.currentTarget.dataset.copy), status = document.getElementById('copy-status');
    try { await navigator.clipboard.writeText(field.value); status.textContent = 'Link copied.'; }
    catch { field.focus(); field.select(); status.textContent = 'Select and copy the link.'; }
  });
  document.querySelector('[data-share]')?.addEventListener('click', async event => {
    try { if (navigator.share) await navigator.share({ title: document.title, url: event.currentTarget.dataset.share }); else document.querySelector('[data-copy]').click(); }
    catch (error) { if (error.name !== 'AbortError') document.getElementById('copy-status').textContent = 'Sharing is unavailable. Copy the link instead.'; }
  });
})();
