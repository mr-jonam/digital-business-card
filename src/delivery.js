import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { transaction, json, audit } from './db.js';
import { InputError, inquiry } from './validation.js';

export async function receiveInquiry(pool, publicId, input) {
  const data = inquiry(input);
  if (!/^[a-f0-9-]{36}$/.test(input.submission_id || '')) throw new InputError('Reload the page before submitting.');
  return transaction(pool, async connection => {
    const [[row]] = await connection.execute("SELECT id,published_recipient FROM profiles WHERE public_id=? AND status='published' FOR UPDATE", [publicId]);
    if (!row?.published_recipient) throw new InputError('Card unavailable.', 404);
    const [[previous]] = await connection.execute('SELECT id FROM inquiries WHERE submission_id=? AND profile_id=?', [input.submission_id, row.id]);
    if (previous) return previous.id;
    const id = randomUUID();
    await connection.execute('INSERT INTO inquiries(id,profile_id,submission_id,kind,name,email,phone,message) VALUES(?,?,?,?,?,?,?,?)', [id, row.id, input.submission_id, data.kind, data.name, data.email, data.phone, data.message]);
    await connection.execute('INSERT INTO outbox(id,inquiry_id,recipient,available_at) VALUES(?,?,?,?)', [randomUUID(), id, row.published_recipient, Date.now()]);
    return id;
  });
}

export function createMailer(config) {
  if (!config.smtp) return null;
  const { from, ...transport } = config.smtp;
  return nodemailer.createTransport({ ...transport, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000, disableFileAccess: true, disableUrlAccess: true });
}

export async function deliverOne(pool, config, mailer) {
  await pool.execute("UPDATE outbox SET status='failed',last_error='LEASE_EXPIRED' WHERE status='sending' AND lease_until<? AND attempts>=5", [Date.now()]);
  if (!mailer) return false;
  const now = Date.now(), lease = randomUUID();
  const item = await transaction(pool, async connection => {
    const [[row]] = await connection.execute("SELECT * FROM outbox WHERE ((status='pending' AND available_at<=?) OR (status='sending' AND lease_until<?)) AND attempts<5 ORDER BY available_at LIMIT 1 FOR UPDATE SKIP LOCKED", [now, now]);
    if (!row) return null;
    await connection.execute("UPDATE outbox SET status='sending',lease_token=?,lease_until=?,attempts=attempts+1 WHERE id=?", [lease, now + 120000, row.id]);
    return row;
  });
  if (!item) return false;
  try {
    const [[row]] = await pool.execute('SELECT i.*,p.published FROM inquiries i JOIN profiles p ON p.id=i.profile_id WHERE i.id=?', [item.inquiry_id]);
    if (!row) return true;
    const snapshot = json(row.published);
    const text = [`New request from the card for ${snapshot.first_name} ${snapshot.last_name}.`, '', `Type: ${row.kind === 'message' ? 'Message' : 'Callback'}`, `Name: ${row.name || 'Not provided'}`, `Email: ${row.email || 'Not provided'}`, `Phone: ${row.phone || 'Not provided'}`, '', row.message, '', `Request: ${row.id}`, 'Manage and delete this data in the administration area.'].join('\n');
    await mailer.sendMail({ from: config.smtp.from, to: item.recipient, replyTo: row.email || undefined, subject: row.kind === 'message' ? 'New message from your digital business card' : 'Callback request from your digital business card', text, messageId: `<${item.id}@${new URL(config.origin).hostname}>` });
    await pool.execute("UPDATE outbox SET status='sent',sent_at=UTC_TIMESTAMP(),lease_until=0,last_error=NULL WHERE id=? AND lease_token=?", [item.id, lease]);
  } catch (error) {
    // Codes only: SMTP errors can contain recipients or credentials.
    const code = /^[A-Z0-9_]{1,40}$/.test(error.code || '') ? error.code : 'DELIVERY_ERROR';
    await pool.execute("UPDATE outbox SET status=?,available_at=?,lease_until=0,last_error=? WHERE id=? AND lease_token=?", [item.attempts + 1 >= 5 ? 'failed' : 'pending', Date.now() + 60000 * 2 ** item.attempts, code, item.id, lease]);
  }
  return true;
}

export async function purge(pool, retention) {
  const cutoff = new Date(Date.now() - retention * 86400000);
  const [result] = await pool.execute('DELETE FROM inquiries WHERE created_at<?', [cutoff]);
  await pool.execute('DELETE FROM web_sessions WHERE expires<?', [Date.now()]);
  await pool.execute('DELETE FROM rate_limits WHERE expires<?', [Date.now()]);
  await pool.execute('DELETE FROM audit_events WHERE created_at<?', [new Date(Date.now() - 90 * 86400000)]);
  return result.affectedRows;
}

export async function retryInquiry(pool, id, user, findProfile) {
  await transaction(pool, async connection => {
    const [[row]] = await connection.execute('SELECT profile_id FROM inquiries WHERE id=?', [id]);
    if (!row) throw new InputError('Request unavailable.', 404);
    await findProfile(connection, row.profile_id, user, true);
    const [[item]] = await connection.execute('SELECT status,lease_until FROM outbox WHERE inquiry_id=? FOR UPDATE', [id]);
    if (!item || item.status === 'sent' || item.status === 'sending') throw new InputError('The notification has already been sent or is being sent.', 409);
    await connection.execute("UPDATE outbox SET status='pending',attempts=0,available_at=?,last_error=NULL WHERE inquiry_id=?", [Date.now(), id]);
    await audit(connection, user.id, 'inquiry.retry', id);
  });
}
