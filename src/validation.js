import { isIP } from 'node:net';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

export class InputError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}

export function scalar(value, label, max = 120, required = false) {
  if (typeof value !== 'string') value = '';
  value = value.trim();
  if ((required && !value) || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new InputError(`${label}: invalid value (maximum ${max} characters).`);
  return value;
}
export function email(value, required = false) {
  value = scalar(value, 'Email', 254, required);
  if (value && !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i.test(value)) throw new InputError('Enter a valid email address.');
  return value;
}
export function phone(value) {
  value = scalar(value, 'Phone', 40);
  if (!value) return '';
  if (!value.startsWith('+')) throw new InputError('Phone: include the country code, for example +39.');
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed?.isPossible()) throw new InputError('Enter a valid phone number with a country code.');
  return parsed.number;
}
export function publicUrl(value) {
  value = scalar(value, 'Link', 2048, true);
  let url;
  try { url = new URL(value); } catch { throw new InputError('Enter a complete HTTPS URL.'); }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.') || isIP(host) || /(?:^|\.)(localhost|local|internal|test|invalid)$/.test(host) || url.port && url.port !== '443') throw new InputError('Links must use HTTPS and a public domain name.');
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
  if (links.length > 12) throw new InputError('Maximum 12 links per profile.');
  return {
    first_name: scalar(input.first_name, 'First name', 80, true),
    last_name: scalar(input.last_name, 'Last name', 80, true),
    title: scalar(input.title, 'Job title', 120, true),
    company: scalar(input.company, 'Organization', 120),
    recipient: email(input.recipient, true),
    phone: phone(input.phone),
    photo: '',
    links: links.map(link => ({ label: scalar(link.label, 'Link label', 80, true), description: scalar(link.description, 'Link description', 100), url: publicUrl(link.url), kind: oneOf(link.kind, ['linkedin','site'], 'site') })),
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
  if (!kind) throw new InputError('Invalid request type.');
  const result = {
    kind, name: scalar(input.name, 'Name', 100), email: email(input.email, kind === 'message'), phone: phone(input.phone),
    message: typeof input.message === 'string' ? input.message.trim().replace(/\r\n?/g, '\n') : '',
  };
  if (!result.email && !result.phone) throw new InputError('Enter an email address or phone number.');
  if (result.message.length > 3000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result.message) || kind === 'message' && !result.message) throw new InputError('Enter a valid message (maximum 3000 characters).');
  return result;
}
