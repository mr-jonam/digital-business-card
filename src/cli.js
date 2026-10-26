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
    console.log('Initial schema verified.');
  } else if (command === 'user:add' || command === 'user:reset') {
    const address = email(values.email, true).toLowerCase();
    if (!['admin','editor'].includes(values.role)) throw new Error('Role: admin or editor.');
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
        if (!user) throw new Error('User not found.');
        await connection.execute(`UPDATE users SET password_hash=?,active=1${values['reset-totp'] ? ',totp_secret=NULL,totp_counter=NULL' : ''} WHERE id=?`, [hash, user.id]);
        await connection.execute('DELETE FROM web_sessions WHERE user_id=?', [user.id]);
        await audit(connection, null, 'cli.user-reset', user.id);
      }
    });
    console.log('Account updated.');
    if (generated) console.log(`Initial password (store in a password manager): ${password}`);
  } else if (command === 'import') {
    if (!values.file) throw new Error('Specify --file /path/to/profiles.json');
    const profiles = JSON.parse(await readFile(values.file, 'utf8'));
    if (!Array.isArray(profiles) || profiles.length > 100) throw new Error('The file must be an array of up to 100 profiles.');
    const [[actor]] = await pool.execute("SELECT id,role FROM users WHERE role='admin' AND active=1 ORDER BY created_at LIMIT 1");
    if (!actor) throw new Error('Create an administrator first.');
    let created = 0, updated = 0, skipped = 0;
    for (const input of profiles) {
      const recipient = email(input.recipient, true);
      const [[existing]] = await pool.execute("SELECT id FROM profiles WHERE JSON_UNQUOTE(JSON_EXTRACT(draft,'$.recipient'))=? AND JSON_UNQUOTE(JSON_EXTRACT(draft,'$.first_name'))=? AND JSON_UNQUOTE(JSON_EXTRACT(draft,'$.last_name'))=?", [recipient, input.first_name, input.last_name]);
      if (existing) {
        if (values.update) { const row = await findProfile(pool, existing.id, actor); await updateProfile(pool, row.id, { ...input, version: row.version, owner_id: row.owner_id }, actor); updated++; }
        else skipped++;
      } else { await createProfile(pool, input, actor); created++; }
    }
    console.log(`Import: ${created} created, ${updated} updated, ${skipped} already present. Profiles are drafts: publish them from the dashboard.`);
  } else if (command === 'purge') {
    console.log(`Expired requests deleted: ${await purge(pool, config.privacy.retention)}.`);
  } else throw new Error('Commands: migrate, user:add, user:reset, import, purge.');
} catch (error) {
  console.error(error.code ? `Operation failed (${error.code}). Check configuration and permissions.` : error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
