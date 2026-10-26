import { randomBytes, randomUUID } from 'node:crypto';
import { transaction, json, audit } from './db.js';
import { InputError, profile as validate, publishedSnapshot } from './validation.js';

export async function listProfiles(pool, user) {
  const [rows] = user.role === 'admin'
    ? await pool.execute('SELECT id,public_id,draft,status,version,revision,owner_id FROM profiles ORDER BY created_at,id')
    : await pool.execute('SELECT id,public_id,draft,status,version,revision,owner_id FROM profiles WHERE owner_id=? ORDER BY created_at,id', [user.id]);
  return rows.map(row => ({ ...row, draft: json(row.draft) }));
}

export async function findProfile(connection, id, user, lock = false) {
  const [rows] = await connection.execute(`SELECT * FROM profiles WHERE id=?${lock ? ' FOR UPDATE' : ''}`, [id]);
  const row = rows[0];
  if (!row || user.role !== 'admin' && row.owner_id !== user.id) throw new InputError('Profile unavailable.', 404);
  return { ...row, draft: json(row.draft), published: json(row.published) };
}

export async function createProfile(pool, input, actor, ownerId = null) {
  const draft = validate(input);
  const id = randomUUID(), publicId = randomBytes(16).toString('hex');
  await transaction(pool, async connection => {
    if (ownerId) {
      const [[owner]] = await connection.execute('SELECT id FROM users WHERE id=? AND active=1', [ownerId]);
      if (!owner) throw new InputError('The assigned user is unavailable.');
    }
    await connection.execute('INSERT INTO profiles(id,public_id,owner_id,draft) VALUES(?,?,?,?)', [id, publicId, ownerId, JSON.stringify(draft)]);
    await audit(connection, actor.id, 'profile.create', id);
  });
  return id;
}

export async function updateProfile(pool, id, input, actor) {
  const next = validate(input);
  await transaction(pool, async connection => {
    const current = await findProfile(connection, id, actor, true);
    if (Number(input.version) !== current.version) throw new InputError('The profile was changed in another tab. Reload before editing.', 409);
    next.photo = current.draft.photo || '';
    let owner = current.owner_id;
    if (actor.role === 'admin') {
      owner = typeof input.owner_id === 'string' && input.owner_id ? input.owner_id : null;
      if (owner) {
        const [[found]] = await connection.execute('SELECT id FROM users WHERE id=? AND active=1', [owner]);
        if (!found) throw new InputError('The assigned user is unavailable.');
      }
    }
    await connection.execute('UPDATE profiles SET draft=?,owner_id=?,version=version+1 WHERE id=?', [JSON.stringify(next), owner, id]);
    await audit(connection, actor.id, 'profile.update', id);
  });
}

export async function publishProfile(pool, id, version, actor) {
  await transaction(pool, async connection => {
    const row = await findProfile(connection, id, actor, true);
    if (Number(version) !== row.version) throw new InputError('The draft has changed. Reload before publishing.', 409);
    validate(row.draft);
    const revision = row.revision + 1;
    const snapshot = JSON.stringify(publishedSnapshot(row.draft, revision));
    await connection.execute('INSERT INTO revisions(profile_id,revision,snapshot,actor_id) VALUES(?,?,?,?)', [id, revision, snapshot, actor.id]);
    await connection.execute("UPDATE profiles SET published=?,published_recipient=?,revision=?,status='published',version=version+1 WHERE id=?", [snapshot, row.draft.recipient, revision, id]);
    await audit(connection, actor.id, 'profile.publish', id);
  });
}

export async function suspendProfile(pool, id, actor) {
  await transaction(pool, async connection => {
    await findProfile(connection, id, actor, true);
    await connection.execute("UPDATE profiles SET status='suspended',version=version+1 WHERE id=?", [id]);
    await audit(connection, actor.id, 'profile.suspend', id);
  });
}

export async function publicProfile(pool, publicId) {
  if (!/^[a-f0-9]{32}$/.test(publicId)) throw new InputError('Card unavailable.', 404);
  const [[row]] = await pool.execute("SELECT id,public_id,published,published_recipient FROM profiles WHERE public_id=? AND status='published'", [publicId]);
  if (!row?.published) throw new InputError('Card unavailable.', 404);
  return { ...row, published: json(row.published) };
}
