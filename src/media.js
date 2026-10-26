import { randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { transaction, audit } from './db.js';
import { InputError } from './validation.js';
import { findProfile } from './profiles.js';

export async function loadBrand(config) {
  if (!config.brandFile) return { name: 'Digital Card', logo: null, mark: null };
  const filename = path.resolve(config.brandFile);
  const input = JSON.parse(await readFile(filename, 'utf8'));
  const name = typeof input.name === 'string' && input.name.length <= 120 ? input.name : 'Digital Card';
  const images = {};
  for (const kind of ['logo','mark']) {
    if (!input[kind]) { images[kind] = null; continue; }
    const buffer = await readFile(path.resolve(path.dirname(filename), input[kind]));
    if (buffer.length > 5 * 1024 * 1024) throw new Error('Immagine brand troppo grande.');
    const image = sharp(buffer, { limitInputPixels: 16777216, animated: false });
    const metadata = await image.metadata();
    if (!['png','jpeg','webp'].includes(metadata.format)) throw new Error('Logo: usare PNG, JPEG o WebP.');
    images[kind] = await image.png().toBuffer();
  }
  return { name, ...images };
}

export async function savePhoto(pool, config, id, user, version, file) {
  await findProfile(pool, id, user);
  if (!file) throw new InputError('Scegli una foto PNG, JPEG o WebP (massimo 2 MB).');
  let output;
  try {
    const image = sharp(file.buffer, { limitInputPixels: 16777216, animated: false });
    const meta = await image.metadata();
    if (!['jpeg','png','webp'].includes(meta.format)) throw new Error('format');
    output = await image.rotate().resize(1000, 1000, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch { throw new InputError('Immagine non valida: usa PNG, JPEG o WebP fino a 16 megapixel.'); }
  const filename = `${randomUUID()}.webp`;
  await mkdir(path.join(config.storage, 'photos'), { recursive: true });
  await writeFile(path.join(config.storage, 'photos', filename), output, { flag: 'wx', mode: 0o640 });
  try { await transaction(pool, async connection => {
    const row = await findProfile(connection, id, user, true);
    if (Number(version) !== row.version) throw new InputError('Profilo modificato: ricarica prima di caricare la foto.', 409);
    row.draft.photo = filename;
    await connection.execute('UPDATE profiles SET draft=?,version=version+1 WHERE id=?', [JSON.stringify(row.draft), id]);
    await audit(connection, user.id, 'profile.photo', id);
  }); } catch (error) {
    await unlink(path.join(config.storage, 'photos', filename));
    throw error;
  }
}

export function photoPath(config, filename) {
  if (!/^[a-f0-9-]{36}\.webp$/.test(filename || '')) throw new InputError('Foto non disponibile.', 404);
  return path.join(config.storage, 'photos', filename);
}
