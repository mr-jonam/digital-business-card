import { Router } from 'express';
import QRCode from 'qrcode';
import { audit, transaction } from './db.js';
import { email, InputError } from './validation.js';
import { passwordHash, passwordMatches, checkPassword, throttle, token, newTotp, totpFor, totpCounter, encrypt, decrypt } from './security.js';

const regenerate = req => new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
const save = req => new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));

export function userLoader(pool) {
  return async (req, res, next) => {
    res.locals.user = null;
    if (req.session.userId) {
      const [[user]] = await pool.execute('SELECT id,email,role,active,totp_secret FROM users WHERE id=?', [req.session.userId]);
      if (user?.active && Date.now() - req.session.authAt < 8 * 3600000) res.locals.user = user;
      else { req.session.userId = null; req.session.verified = false; }
    }
    next();
  };
}

export function requireUser(req, res, next) {
  if (!res.locals.user) return res.redirect(303, '/admin/login');
  if (!req.session.verified) return res.redirect(303, '/admin/security');
  next();
}
export function requireAdmin(req, res, next) {
  if (res.locals.user?.role !== 'admin') throw new InputError('You do not have permission to perform this action.', 403);
  next();
}

export async function authRoutes(pool, config) {
  const router = Router();
  const dummy = await passwordHash(token());
  router.get('/login', (req, res) => res.render('login', { title: 'Sign in' }));
  router.post('/login', async (req, res) => {
    const address = email(req.body.email, true).toLowerCase();
    const limited = !await throttle(pool, config.secret, 'login-ip', req.ip, 30, 900) || !await throttle(pool, config.secret, 'login-account', address, 10, 900);
    if (limited) throw new InputError('Too many attempts. Please try again in 15 minutes.', 429);
    const [[user]] = await pool.execute('SELECT * FROM users WHERE email=?', [address]);
    const password = typeof req.body.password === 'string' && Buffer.byteLength(req.body.password) <= 72 ? req.body.password : '';
    let valid = await passwordMatches(password, user?.password_hash || dummy);
    valid &&= !!user?.active;
    if (valid && user.totp_secret) {
      const counter = totpCounter(decrypt(user.totp_secret, config.secret), req.body.otp);
      if (counter === null) valid = false;
      else {
        const [updated] = await pool.execute('UPDATE users SET totp_counter=? WHERE id=? AND (totp_counter IS NULL OR totp_counter<?)', [counter, user.id, counter]);
        valid = updated.affectedRows === 1;
      }
    }
    if (!valid) throw new InputError('Invalid credentials or verification code.', 401);
    await regenerate(req);
    req.session.userId = user.id;
    req.session.authAt = Date.now();
    req.session.verified = user.role !== 'admin' || !!user.totp_secret;
    req.session.csrf = token();
    await audit(pool, user.id, 'auth.login', user.id);
    await save(req);
    res.redirect(303, req.session.verified ? '/admin' : '/admin/security');
  });
  router.post('/logout', async (req, res) => {
    if (res.locals.user) await audit(pool, res.locals.user.id, 'auth.logout', res.locals.user.id);
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie(config.secure ? '__Host-card_session' : 'card_session', { path: '/' });
    res.redirect(303, '/admin/login');
  });
  router.use('/security', (req, res, next) => res.locals.user ? next() : res.redirect(303, '/admin/login'));
  router.get('/security', (req, res) => {
    if (!res.locals.user.totp_secret) req.session.pendingTotp ||= newTotp();
    res.render('security', { title: 'Account security', secret: res.locals.user.totp_secret ? null : req.session.pendingTotp });
  });
  router.get('/security/qr.png', async (req, res) => {
    if (!req.session.pendingTotp || res.locals.user.totp_secret) throw new InputError('QR code unavailable.', 404);
    res.type('png').send(await QRCode.toBuffer(totpFor(req.session.pendingTotp, res.locals.user.email).toString(), { margin: 4, scale: 7 }));
  });
  router.post('/security/totp', async (req, res) => {
    if (!await throttle(pool, config.secret, 'totp-setup', res.locals.user.id, 10, 900)) throw new InputError('Too many attempts. Please try again in 15 minutes.', 429);
    const secret = req.session.pendingTotp;
    const counter = secret ? totpCounter(secret, req.body.otp) : null;
    if (res.locals.user.totp_secret || counter === null) throw new InputError('Invalid code. Check your phone’s date and time.');
    const [result] = await pool.execute('UPDATE users SET totp_secret=?,totp_counter=? WHERE id=? AND totp_secret IS NULL', [encrypt(secret, config.secret), counter, res.locals.user.id]);
    if (!result.affectedRows) throw new InputError('The configuration has changed. Sign in again.', 409);
    delete req.session.pendingTotp;
    req.session.verified = true;
    await audit(pool, res.locals.user.id, 'auth.totp-enable', res.locals.user.id);
    await save(req);
    res.redirect(303, '/admin');
  });
  router.post('/security/password', requireUser, async (req, res) => {
    if (!await throttle(pool, config.secret, 'password-change', res.locals.user.id, 5, 900)) throw new InputError('Too many attempts. Please try again later.', 429);
    checkPassword(req.body.new_password);
    if (req.body.new_password !== req.body.confirm_password) throw new InputError('The new passwords do not match.');
    const [[current]] = await pool.execute('SELECT password_hash FROM users WHERE id=?', [res.locals.user.id]);
    if (!await passwordMatches(typeof req.body.current_password === 'string' ? req.body.current_password : '', current.password_hash)) throw new InputError('The current password is incorrect.');
    const hash = await passwordHash(req.body.new_password);
    await transaction(pool, async connection => {
      await connection.execute('UPDATE users SET password_hash=? WHERE id=?', [hash, res.locals.user.id]);
      await connection.execute('DELETE FROM web_sessions WHERE user_id=?', [res.locals.user.id]);
      await audit(connection, res.locals.user.id, 'auth.password-change', res.locals.user.id);
    });
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.redirect(303, '/admin/login');
  });
  return router;
}
