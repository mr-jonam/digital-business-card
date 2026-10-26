import QRCode from 'qrcode';

export function cardUrl(config, id) { return `${config.origin}/c/${id}`; }
const escape = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

export function foldLine(line) {
  let result = '', current = '', bytes = 0;
  for (const character of line) {
    const length = Buffer.byteLength(character);
    if (bytes + length > 75) { result += current + '\r\n'; current = ' '; bytes = 1; }
    current += character; bytes += length;
  }
  return result + current;
}
export function vcard(snapshot, url, compact = false) {
  const lines = ['BEGIN:VCARD','VERSION:3.0',`N:${escape(snapshot.last_name)};${escape(snapshot.first_name)};;;`,`FN:${escape(snapshot.first_name)} ${escape(snapshot.last_name)}`];
  if (snapshot.company) lines.push(`ORG:${escape(snapshot.company)}`);
  if (snapshot.title) lines.push(`TITLE:${escape(snapshot.title)}`);
  if (snapshot.phone) lines.push(`TEL;TYPE=WORK,VOICE:${escape(snapshot.phone)}`);
  lines.push(`URL:${escape(url)}`);
  if (!compact) for (const link of snapshot.links || []) lines.push(`URL:${escape(link.url)}`);
  lines.push('END:VCARD');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
export async function qr(snapshot, url, mode = 'page', format = 'png') {
  const payload = mode === 'contact' ? vcard(snapshot, url, true) : url;
  const options = { errorCorrectionLevel: 'Q', margin: 4, scale: 10, color: { dark: snapshot.qr_ink === 'petrol' ? '#00383fff' : '#000000ff', light: '#ffffffff' } };
  return format === 'svg' ? QRCode.toString(payload, { ...options, type: 'svg' }) : QRCode.toBuffer(payload, options);
}
