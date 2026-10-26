import { readFile } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { loadConfig } from './config.js';
import { createPool, migrate, transaction, audit } from './db.js';
import { passwordHash, checkPassword } from './security.js';
import { email } from './validation.js';
import { createProfile, updateProfile, findProfile } from './profiles.js';
import { purge } from './delivery.js';

const config = loadConfig(), pool = createPool(config.databaseUrl);
const [command, ...args] = process.argv.slice(2);
const { values } = parseArgs({ args, options: {
  email: { type: 'string' }, role: { type: 'string', default: 'admin' },
  'password-file': { type: 'string' }, file: { type: 'string' }, 'reset-totp': { type: 'boolean' }, update: { type: 'boolean' },
} });
try {
  if (command === 'migrate') {
    await migrate(pool);
    console.log('Schema iniziale verificato.');
  } else if (command === 'user:add' || command === 'user:reset') {
    const address = email(values.email, true).toLowerCase();
    if (!['admin','editor'].includes(values.role)) throw new Error('Ruolo: admin oppure editor.');
    const generated = !values['password-file'];
    const password = generated ? randomBytes(24).toString('base64url') : (await readFile(values['password-file'], 'utf8')).replace(/\r?\n$/, '');
    checkPassword(password);
    const hash = await passwordHash(password);
    await transaction(pool, async connection => {
      if (command === 'user:add') {
        const id = randomUUID();
        await connection.execute('INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,?)', [id, address, hash, values.role]);
        await audit(connection, null, 'cli.user-create', id);
      } else {
        const [[user]] = await connection.execute('SELECT id FROM users WHERE email=? FOR UPDATE', [address]);
        if (!user) throw new Error('Utente non trovato.');
        await connection.execute(`UPDATE users SET password_hash=?,active=1${values['reset-totp'] ? ',totp_secret=NULL,totp_counter=NULL' : ''} WHERE id=?`, [hash, user.id]);
        await connection.execute('DELETE FROM web_sessions WHERE user_id=?', [user.id]);
        await audit(connection, null, 'cli.user-reset', user.id);
      }
    });
    console.log('Utenza aggiornata.');
    if (generated) console.log(`Password iniziale (conservare in un password manager): ${password}`);
  } else if (command === 'import') {
    if (!values.file) throw new Error('Specificare --file /percorso/profiles.json');
    const profiles = JSON.parse(await readFile(values.file, 'utf8'));
    if (!Array.isArray(profiles) || profiles.length > 100) throw new Error('Il file deve essere un array di massimo 100 profili.');
    const [[actor]] = await pool.execute("SELECT id,role FROM users WHERE role='admin' AND active=1 ORDER BY created_at LIMIT 1");
    if (!actor) throw new Error('Creare prima un amministratore.');
    let created = 0, updated = 0, skipped = 0;
    for (const input of profiles) {
      const recipient = email(input.recipient, true);
      const [[existing]] = await pool.execute("SELECT id FROM profiles WHERE JSON_UNQUOTE(JSON_EXTRACT(draft,'$.recipient'))=? AND JSON_UNQUOTE(JSON_EXTRACT(draft,'$.first_name'))=? AND JSON_UNQUOTE(JSON_EXTRACT(draft,'$.last_name'))=?", [recipient, input.first_name, input.last_name]);
      if (existing) {
        if (values.update) { const row = await findProfile(pool, existing.id, actor); await updateProfile(pool, row.id, { ...input, version: row.version, owner_id: row.owner_id }, actor); updated++; }
        else skipped++;
      } else { await createProfile(pool, input, actor); created++; }
    }
    console.log(`Importazione: ${created} creati, ${updated} aggiornati, ${skipped} già presenti. Profili in bozza: pubblicarli dal pannello.`);
  } else if (command === 'purge') {
    console.log(`Richieste eliminate per scadenza: ${await purge(pool, config.privacy.retention)}.`);
  } else throw new Error('Comandi: migrate, user:add, user:reset, import, purge.');
} catch (error) {
  console.error(error.code ? `Operazione fallita (${error.code}). Controllare configurazione e permessi.` : error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
