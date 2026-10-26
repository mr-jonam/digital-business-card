import QRCode from 'qrcode';
import sharp from 'sharp';

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
export async function qr(snapshot, url, mode = 'page', format = 'png', mark = null) {
  const payload = mode === 'contact' ? vcard(snapshot, url, true) : url;
  const options = { errorCorrectionLevel: mark ? 'H' : 'Q', margin: 4, scale: 10, color: { dark: snapshot.qr_ink === 'petrol' ? '#00383fff' : '#000000ff', light: '#ffffffff' } };
  if (!mark) return format === 'svg' ? QRCode.toString(payload, { ...options, type: 'svg' }) : QRCode.toBuffer(payload, options);
  // Keep the quiet zone intact and the central logo small, on an opaque white patch.
  const modules = QRCode.create(payload, options).modules.size;
  let patch = Math.max(5, Math.floor(modules * .17));
  if (patch % 2 === 0) patch--;
  const offset = (modules - patch) / 2 + options.margin;
  const image = await sharp(mark).trim().resize((patch - 2) * options.scale, (patch - 2) * options.scale, { fit: 'contain', background: '#ffffff00' }).png().toBuffer();
  if (format === 'svg') {
    const svg = await QRCode.toString(payload, { ...options, type: 'svg' });
    return svg.replace('</svg>', `<rect x="${offset}" y="${offset}" width="${patch}" height="${patch}" fill="#fff"/><image x="${offset + 1}" y="${offset + 1}" width="${patch - 2}" height="${patch - 2}" href="data:image/png;base64,${image.toString('base64')}"/></svg>`);
  }
  const pixels = patch * options.scale, inset = offset * options.scale;
  const plate = await sharp({ create: { width: pixels, height: pixels, channels: 4, background: '#fff' } }).composite([{ input: image, left: options.scale, top: options.scale }]).png().toBuffer();
  return sharp(await QRCode.toBuffer(payload, options)).composite([{ input: plate, left: inset, top: inset }]).png().toBuffer();
}
