import { isIP } from 'node:net';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

export class InputError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}

export function scalar(value, label, max = 120, required = false) {
  if (typeof value !== 'string') value = '';
  value = value.trim();
  if ((required && !value) || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new InputError(`${label}: valore non valido (massimo ${max} caratteri).`);
  return value;
}
export function email(value, required = false) {
  value = scalar(value, 'Email', 254, required);
  if (value && !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i.test(value)) throw new InputError('Inserisci un indirizzo email valido.');
  return value;
}
export function phone(value) {
  value = scalar(value, 'Telefono', 40);
  if (!value) return '';
  if (!value.startsWith('+')) throw new InputError('Telefono: includi il prefisso internazionale, per esempio +39.');
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed?.isPossible()) throw new InputError('Inserisci un numero di telefono valido con prefisso internazionale.');
  return parsed.number;
}
export function publicUrl(value) {
  value = scalar(value, 'Link', 2048, true);
  let url;
  try { url = new URL(value); } catch { throw new InputError('Inserisci un link HTTPS completo.'); }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.') || isIP(host) || /(?:^|\.)(localhost|local|internal|test|invalid)$/.test(host) || url.port && url.port !== '443') throw new InputError('I link devono usare HTTPS e un nome di dominio pubblico.');
  return url.href;
}
function oneOf(value, allowed, fallback) { return allowed.includes(value) ? value : fallback; }
export function appearance(input = {}) {
  const color = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : '';
  return {
    theme: oneOf(input.theme, ['graphite','midnight','forest','petrol'], 'graphite'),
    art: oneOf(input.art, ['qa-platforms','none','qa-flow','coverage'], 'qa-platforms'),
    finish: oneOf(input.finish, ['holo','spotlight','plain'], 'holo'),
    backdrop: oneOf(input.backdrop, ['qa-grid','grid','plain'], 'qa-grid'),
    surface: color(input.surface), accent: color(input.accent),
  };
}
export function profile(input) {
  const array = value => Array.isArray(value) ? value : value ? [value] : [];
  let links;
  if (Array.isArray(input.links)) links = input.links;
  else {
    const labels = array(input.link_label), urls = array(input.link_url), descriptions = array(input.link_description), kinds = array(input.link_kind);
    links = urls.map((url, index) => ({ label: labels[index], url, description: descriptions[index], kind: kinds[index] })).filter(link => link.url || link.label);
  }
  if (links.length > 12) throw new InputError('Massimo 12 link per profilo.');
  return {
    first_name: scalar(input.first_name, 'Nome', 80, true),
    last_name: scalar(input.last_name, 'Cognome', 80, true),
    title: scalar(input.title, 'Titolo', 120, true),
    company: scalar(input.company, 'Organizzazione', 120),
    recipient: email(input.recipient, true),
    phone: phone(input.phone),
    photo: '',
    links: links.map(link => ({ label: scalar(link.label, 'Titolo link', 80, true), description: scalar(link.description, 'Descrizione link', 100), url: publicUrl(link.url), kind: oneOf(link.kind, ['linkedin','site'], 'site') })),
    appearance: appearance(input.appearance || input),
    qr_ink: oneOf(input.qr_ink, ['black','petrol'], 'black'),
  };
}
export function publishedSnapshot(draft, revision) {
  const { recipient, ...snapshot } = draft;
  return { ...snapshot, revision, published_at: new Date().toISOString() };
}
export function inquiry(input) {
  const kind = input.kind === 'message' ? 'message' : input.kind === 'callback' ? 'callback' : '';
  if (!kind) throw new InputError('Tipo richiesta non valido.');
  const result = {
    kind, name: scalar(input.name, 'Nome', 100), email: email(input.email, kind === 'message'), phone: phone(input.phone),
    message: typeof input.message === 'string' ? input.message.trim().replace(/\r\n?/g, '\n') : '',
  };
  if (!result.email && !result.phone) throw new InputError('Inserisci almeno un recapito: email o telefono.');
  if (result.message.length > 3000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result.message) || kind === 'message' && !result.message) throw new InputError('Inserisci un messaggio valido (massimo 3000 caratteri).');
  return result;
}
