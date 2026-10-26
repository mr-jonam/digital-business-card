import path from 'node:path';

export function loadConfig(env = process.env) {
  const origin = new URL(env.PUBLIC_ORIGIN || 'http://127.0.0.1:3600');
  const production = env.NODE_ENV === 'production';
  if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password || !['http:', 'https:'].includes(origin.protocol)) throw new Error('PUBLIC_ORIGIN must contain only a protocol and host.');
  if (production && origin.protocol !== 'https:') throw new Error('PUBLIC_ORIGIN requires HTTPS in production.');
  const secret = env.SESSION_SECRET || '';
  if (secret.length < 48 || secret.includes('CHANGE_ME')) throw new Error('Set a random SESSION_SECRET (at least 48 characters).');
  if (!env.DATABASE_URL?.startsWith('mysql://')) throw new Error('Set the MySQL DATABASE_URL.');
  const retention = Number(env.RETENTION_DAYS || 30);
  const port = Number(env.PORT || 3600);
  if (!Number.isInteger(retention) || retention < 1 || retention > 365 || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid RETENTION_DAYS or PORT.');
  const smtpPort = Number(env.SMTP_PORT || 587);
  const smtpSecure = env.SMTP_SECURE === 'true';
  const smtpConfigured = !!(env.SMTP_HOST && env.SMTP_FROM && env.SMTP_USER && env.SMTP_PASSWORD);
  if ([env.SMTP_HOST, env.SMTP_FROM, env.SMTP_USER, env.SMTP_PASSWORD].some(Boolean) && !smtpConfigured) throw new Error('Incomplete SMTP configuration: set host, sender, user and password, or leave all four empty.');
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) throw new Error('Invalid SMTP_PORT.');
  if (smtpConfigured && production && !(smtpSecure && smtpPort === 465) && !(!smtpSecure && smtpPort === 587)) throw new Error('Production SMTP: use port 465/TLS or 587/STARTTLS.');
  const privacy = {
    controller: (env.PRIVACY_CONTROLLER || '').trim(),
    contact: (env.PRIVACY_CONTACT || '').trim(),
    notice: (env.PRIVACY_NOTICE || '').trim(),
    retention,
  };
  return {
    production, origin: origin.origin, secure: origin.protocol === 'https:', secret,
    host: env.HOST || '127.0.0.1', port, databaseUrl: env.DATABASE_URL,
    storage: path.resolve(env.STORAGE_DIR || './storage'), brandFile: env.BRAND_FILE || '',
    privacy, formsEnabled: !!(privacy.controller && privacy.contact && privacy.notice),
    smtp: smtpConfigured ? {
      host: env.SMTP_HOST, port: smtpPort, secure: smtpSecure,
      requireTLS: production && !smtpSecure,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      from: env.SMTP_FROM,
    } : null,
  };
}
