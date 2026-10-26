import express, { Router } from 'express';
import session from 'express-session';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { MySqlSessionStore, json, transaction, audit } from './db.js';
import { csrf, throttle } from './security.js';
import { authRoutes, userLoader, requireUser, requireAdmin } from './auth.js';
import { InputError } from './validation.js';
import { listProfiles, findProfile, createProfile, updateProfile, publishProfile, suspendProfile, publicProfile } from './profiles.js';
import { cardUrl, qr, vcard } from './contact.js';
import { receiveInquiry, retryInquiry } from './delivery.js';
import { loadBrand, savePhoto, photoPath } from './media.js';

const root = fileURLToPath(new URL('..', import.meta.url));

export async function createApp(pool, config) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.set('view engine', 'ejs');
  app.set('views', path.join(root, 'views'));
  const brand = await loadBrand(config);
  app.locals.config = config;
  app.locals.brand = brand;
  app.locals.cardUrl = id => cardUrl(config, id);
  app.use((req, res, next) => {
    res.locals.config = config;
    res.set({
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'",
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store',
    });
    if (config.secure) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  app.get('/health/live', (req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (req, res) => {
    try {
      await pool.execute('SELECT id FROM profiles LIMIT 1');
      res.status(config.formsEnabled ? 200 : 503).json({ status: config.formsEnabled ? 'ready' : 'configuration-required' });
    } catch { res.status(503).json({ status: 'unavailable' }); }
  });
  app.use('/assets', express.static(path.join(root, 'public'), { index: false, dotfiles: 'deny', maxAge: 0 }));
  app.get('/brand/:kind', (req, res) => {
    const image = ['logo','mark'].includes(req.params.kind) ? brand[req.params.kind] : null;
    if (!image) throw new InputError('Image unavailable.', 404);
    res.type('png').send(image);
  });
  // Do not allocate sessions for arbitrary paths or exports.
  app.get('/c/:publicId/contact.vcf', async (req, res) => {
    const row = await publicProfile(pool, req.params.publicId);
    res.type('text/vcard; charset=utf-8').set('Content-Disposition', 'inline; filename="contact.vcf"').send(vcard(row.published, cardUrl(config, row.public_id)));
  });
  app.get('/c/:publicId/qr.:format', async (req, res) => {
    if (!['png','svg'].includes(req.params.format)) throw new InputError('Format unavailable.', 404);
    const row = await publicProfile(pool, req.params.publicId);
    const mode = req.query.mode === 'contact' ? 'contact' : 'page';
    const body = await qr(row.published, cardUrl(config, row.public_id), mode, req.params.format, req.query.logo === '0' ? null : brand.mark);
    res.type(req.params.format === 'svg' ? 'image/svg+xml' : 'image/png');
    if (req.query.download === '1') res.set('Content-Disposition', `attachment; filename="qr-${mode}.${req.params.format}"`);
    res.send(body);
  });
  app.get('/c/:publicId/photo', async (req, res) => {
    const row = await publicProfile(pool, req.params.publicId);
    res.type('webp').sendFile(photoPath(config, row.published.photo));
  });
  const sessions = session({
    name: config.secure ? '__Host-card_session' : 'card_session', secret: config.secret,
    store: new MySqlSessionStore(pool), resave: false, saveUninitialized: false, rolling: true,
    cookie: { httpOnly: true, secure: config.secure, sameSite: 'lax', maxAge: 3600000, path: '/' },
  });
  app.use((req, res, next) => {
    if (!/^\/(?:admin(?:\/|$)|c\/[a-f0-9]{32}(?:\/inquiries)?$)/.test(req.path)) return next();
    if (config.production && !req.secure) throw new InputError('An HTTPS connection is required.', 400);
    next();
  });
  app.get('/', async (req, res) => {
    const [rows] = await pool.execute("SELECT public_id,published FROM profiles WHERE status='published' ORDER BY created_at,id");
    res.render('home', { title: brand.name, profiles: rows.map(row => ({ public_id: row.public_id, ...json(row.published) })) });
  });
  const pages = Router();
  pages.use(async (req, res, next) => {
    if (!await throttle(pool, config.secret, 'session-pages', req.ip, 150, 900)) throw new InputError('Too many requests. Please try again later.', 429);
    next();
  });
  pages.use(sessions);
  pages.use(express.urlencoded({ extended: false, limit: '32kb', parameterLimit: 100 }));
  pages.use(csrf);
  pages.use(userLoader(pool));
  pages.use('/admin', await authRoutes(pool, config));
  pages.get('/c/:publicId', async (req, res) => {
    const row = await publicProfile(pool, req.params.publicId);
    const submissionId = randomUUID();
    req.session.forms = (req.session.forms || []).filter(form => form.created > Date.now() - 3600000).slice(-9);
    req.session.forms.push({ id: submissionId, publicId: row.public_id, created: Date.now() });
    res.render('card', { title: `${row.published.first_name} ${row.published.last_name} | ${brand.name}`, profile: row.published, publicId: row.public_id, submissionId, preview: false });
  });
  pages.post('/c/:publicId/inquiries', async (req, res) => {
    if (!config.formsEnabled) throw new InputError('Contact requests are temporarily unavailable.', 503);
    if (!await throttle(pool, config.secret, 'inquiry-ip', req.ip, 20, 3600)) throw new InputError('Too many requests. Please try again later.', 429);
    const form = req.session.forms?.find(value => value.id === req.body.submission_id && value.publicId === req.params.publicId && value.created > Date.now() - 3600000);
    if (!form) throw new InputError('This form has expired. Reload the card before submitting.', 403);
    if (req.body.website) return res.status(202).render('received', { title: 'Request received', publicId: req.params.publicId });
    await receiveInquiry(pool, req.params.publicId, req.body);
    res.status(201).render('received', { title: 'Request received', publicId: req.params.publicId });
  });
  const admin = Router();
  admin.use(requireUser);
  admin.get('/', async (req, res) => {
    res.render('dashboard', { title: 'Business cards', profiles: await listProfiles(pool, res.locals.user) });
  });
  admin.get('/profiles/new', requireAdmin, async (req, res) => {
    const [users] = await pool.execute('SELECT id,email,role FROM users WHERE active=1 ORDER BY email');
    res.render('profile', { title: 'New profile', row: null, profile: { links: [], appearance: {} }, users });
  });
  admin.post('/profiles', requireAdmin, async (req, res) => {
    const id = await createProfile(pool, req.body, res.locals.user, req.body.owner_id || null);
    res.redirect(303, `/admin/profiles/${id}`);
  });
  admin.get('/profiles/:id', async (req, res) => {
    const row = await findProfile(pool, req.params.id, res.locals.user);
    const [users] = res.locals.user.role === 'admin' ? await pool.execute('SELECT id,email,role FROM users WHERE active=1 ORDER BY email') : [[]];
    res.render('profile', { title: 'Edit profile', row, profile: row.draft, users });
  });
  admin.post('/profiles/:id', async (req, res) => {
    await updateProfile(pool, req.params.id, req.body, res.locals.user);
    res.redirect(303, `/admin/profiles/${req.params.id}`);
  });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 2 } });
  admin.post('/profiles/:id/photo', upload.single('photo'), async (req, res) => {
    await savePhoto(pool, config, req.params.id, res.locals.user, req.body.version, req.file);
    res.json({ ok: true });
  });
  admin.get('/profiles/:id/photo', async (req, res) => {
    const row = await findProfile(pool, req.params.id, res.locals.user);
    res.type('webp').sendFile(photoPath(config, row.draft.photo));
  });
  admin.post('/profiles/:id/publish', async (req, res) => {
    await publishProfile(pool, req.params.id, req.body.version, res.locals.user);
    res.redirect(303, `/admin/profiles/${req.params.id}`);
  });
  admin.post('/profiles/:id/suspend', requireAdmin, async (req, res) => {
    await suspendProfile(pool, req.params.id, res.locals.user);
    res.redirect(303, '/admin');
  });
  admin.get('/profiles/:id/preview', async (req, res) => {
    const row = await findProfile(pool, req.params.id, res.locals.user);
    res.render('card', { title: 'Draft preview', profile: row.draft, publicId: row.public_id, submissionId: '', preview: true, profileId: row.id });
  });
  admin.get('/profiles/:id/share', async (req, res) => {
    const row = await findProfile(pool, req.params.id, res.locals.user);
    if (row.status !== 'published') throw new InputError('Publish the profile before sharing it.');
    res.render('share', { title: 'Share card', row, url: cardUrl(config, row.public_id) });
  });
  admin.get('/inquiries', async (req, res) => {
    const clause = res.locals.user.role === 'admin' ? '' : 'WHERE p.owner_id=?';
    const [rows] = await pool.execute(`SELECT i.*,p.draft,o.status,o.attempts,o.last_error FROM inquiries i JOIN profiles p ON p.id=i.profile_id LEFT JOIN outbox o ON o.inquiry_id=i.id ${clause} ORDER BY i.created_at DESC LIMIT 200`, res.locals.user.role === 'admin' ? [] : [res.locals.user.id]);
    res.render('inquiries', { title: 'Received requests', inquiries: rows.map(row => ({ ...row, draft: json(row.draft) })) });
  });
  admin.post('/inquiries/:id/retry', async (req, res) => {
    await retryInquiry(pool, req.params.id, res.locals.user, findProfile);
    res.redirect(303, '/admin/inquiries');
  });
  admin.post('/inquiries/:id/delete', async (req, res) => {
    await transaction(pool, async connection => {
      const [[row]] = await connection.execute('SELECT profile_id FROM inquiries WHERE id=?', [req.params.id]);
      if (!row) throw new InputError('Request unavailable.', 404);
      await findProfile(connection, row.profile_id, res.locals.user, true);
      const [[delivery]] = await connection.execute('SELECT status FROM outbox WHERE inquiry_id=? FOR UPDATE', [req.params.id]);
      if (delivery?.status === 'sending') throw new InputError('Sending is in progress. Wait before deleting.', 409);
      await connection.execute('DELETE FROM inquiries WHERE id=?', [req.params.id]);
      await audit(connection, res.locals.user.id, 'inquiry.delete', req.params.id);
    });
    res.redirect(303, '/admin/inquiries');
  });
  pages.use('/admin', admin);
  app.use((req, res, next) => /^\/(admin(?:\/|$)|c\/[a-f0-9]{32}(?:\/inquiries)?$)/.test(req.path) ? pages(req, res, next) : next());
  app.use((req, res) => res.status(404).render('error', { title: 'Page unavailable', message: 'The link may be incorrect or the card may be suspended.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error instanceof InputError ? error.status : error instanceof multer.MulterError ? 422 : error.status === 413 ? 413 : error.status === 404 || error.code === 'ENOENT' ? 404 : 500;
    if (status === 500) console.error(JSON.stringify({ event: 'request-error', id: randomUUID(), code: /^[A-Z_0-9]{1,60}$/.test(error.code || '') ? error.code : 'INTERNAL_ERROR' }));
    const message = error instanceof InputError ? error.message : status === 422 || status === 413 ? 'File or request too large. Photos must be no larger than 2 MB.' : status === 404 ? 'Resource unavailable.' : 'The operation could not be completed. Please try again later.';
    res.status(status).render('error', { title: status === 500 ? 'Service temporarily unavailable' : 'Check your request', message });
  });
  return app;
}
