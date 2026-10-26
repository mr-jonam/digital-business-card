import path from 'node:path';

export function loadConfig(env = process.env) {
  const origin = new URL(env.PUBLIC_ORIGIN || 'http://127.0.0.1:3600');
  const production = env.NODE_ENV === 'production';
  if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password || !['http:', 'https:'].includes(origin.protocol)) throw new Error('PUBLIC_ORIGIN deve contenere solo protocollo e host.');
  if (production && origin.protocol !== 'https:') throw new Error('PUBLIC_ORIGIN richiede HTTPS in produzione.');
  const secret = env.SESSION_SECRET || '';
  if (secret.length < 48 || secret.includes('CHANGE_ME')) throw new Error('Configurare SESSION_SECRET casuale (almeno 48 caratteri).');
  if (!env.DATABASE_URL?.startsWith('mysql://')) throw new Error('Configurare DATABASE_URL MySQL.');
  const retention = Number(env.RETENTION_DAYS || 30);
  const port = Number(env.PORT || 3600);
  if (!Number.isInteger(retention) || retention < 1 || retention > 365 || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('RETENTION_DAYS o PORT non valido.');
  const smtpPort = Number(env.SMTP_PORT || 587);
  const smtpSecure = env.SMTP_SECURE === 'true';
  const smtpConfigured = !!(env.SMTP_HOST && env.SMTP_FROM && env.SMTP_USER && env.SMTP_PASSWORD);
  if ([env.SMTP_HOST, env.SMTP_FROM, env.SMTP_USER, env.SMTP_PASSWORD].some(Boolean) && !smtpConfigured) throw new Error('SMTP incompleto: compilare host, mittente, utente e password, oppure lasciarli tutti vuoti.');
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) throw new Error('SMTP_PORT non valida.');
  if (smtpConfigured && production && !(smtpSecure && smtpPort === 465) && !(!smtpSecure && smtpPort === 587)) throw new Error('SMTP produzione: porta 465/TLS oppure 587/STARTTLS.');
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
