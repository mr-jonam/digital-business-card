import { createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv, hkdfSync } from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';
import { transaction } from './db.js';
import { InputError } from './validation.js';

export const token = () => randomBytes(32).toString('hex');
export function equal(a, b) {
  if(typeof a!=='string'||typeof b!=='string')return false;
  const first=Buffer.from(a),second=Buffer.from(b);
  return first.length===second.length&&timingSafeEqual(first,second);
}
export const passwordHash = password => bcrypt.hash(password, 12);
export const passwordMatches = (password, hash) => bcrypt.compare(password, hash);
export function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 14 || Buffer.byteLength(password) > 72) throw new InputError('Password: at least 14 characters, maximum 72 bytes.');
  return password;
}

function encryptionKey(secret) { return Buffer.from(hkdfSync('sha256', secret, 'card-auth-v1', 'totp', 32)); }
export function encrypt(value, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
}
export function decrypt(value, secret) {
  const [iv, tag, payload] = value.split('.').map(part => Buffer.from(part, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(payload), cipher.final()]).toString('utf8');
}
export function totpFor(secret, label = 'Admin') {
  return new OTPAuth.TOTP({ issuer: 'Digital Business Card', label, algorithm: 'SHA1', digits: 6, period: 30, secret });
}
export const newTotp = () => new OTPAuth.Secret({ size: 20 }).base32;
export function totpCounter(secret, code, now = Date.now()) {
  if (!/^\d{6}$/.test(code || '')) return null;
  const delta = totpFor(secret).validate({ token: code, timestamp: now, window: 1 });
  return delta === null ? null : Math.floor(now / 30000) + delta;
}

export async function throttle(pool, secret, scope, key, limit, seconds) {
  const now = Date.now();
  const bucket = createHmac('sha256', secret).update(`${scope}:${key}`).digest('hex');
  return transaction(pool, async connection => {
    await connection.execute('INSERT INTO rate_limits(bucket,attempts,expires) VALUES(?,1,?) ON DUPLICATE KEY UPDATE attempts=IF(expires<?,1,attempts+1), expires=IF(expires<?,VALUES(expires),expires)', [bucket, now + seconds * 1000, now, now]);
    const [[row]] = await connection.execute('SELECT attempts FROM rate_limits WHERE bucket=?', [bucket]);
    return row.attempts <= limit;
  });
}

export function csrf(req, res, next) {
  req.session.csrf ||= token();
  res.locals.csrf = req.session.csrf;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== res.locals.config.origin || !equal(req.body?._csrf || req.get('x-csrf-token'), req.session.csrf)) {
    return res.status(403).render('error', { title: 'Invalid session', message: 'Reload the page and try again.' });
  }
  next();
}
