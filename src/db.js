import mysql from 'mysql2/promise';
import session from 'express-session';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export function createPool(databaseUrl) {
  const url = new URL(databaseUrl);
  return mysql.createPool({
    host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password), database: url.pathname.slice(1),
    connectionLimit: 5, charset: 'utf8mb4', timezone: 'Z', enableKeepAlive: true,
    multipleStatements: false,
  });
}

export async function transaction(pool, callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function migrate(pool) {
  const sql = await readFile(new URL('../migrations/001-initial.sql', import.meta.url), 'utf8');
  for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await pool.query(statement);
}

export const json = value => typeof value === 'string' ? JSON.parse(value) : value;
const sessionHash = id => createHash('sha256').update(id).digest('hex');

export class MySqlSessionStore extends session.Store {
  constructor(pool) { super(); this.pool = pool; }
  get(id, callback) {
    this.pool.execute('SELECT payload FROM web_sessions WHERE id=? AND expires>?', [sessionHash(id), Date.now()])
      .then(([rows]) => callback(null, rows.length ? JSON.parse(rows[0].payload) : null)).catch(callback);
  }
  set(id, value, callback = () => {}) {
    const expires = value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 3600000;
    this.pool.execute('INSERT INTO web_sessions(id,user_id,payload,expires) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),payload=VALUES(payload),expires=VALUES(expires)',
      [sessionHash(id), value.userId || null, JSON.stringify(value), expires]).then(() => callback()).catch(callback);
  }
  destroy(id, callback = () => {}) {
    this.pool.execute('DELETE FROM web_sessions WHERE id=?', [sessionHash(id)]).then(() => callback()).catch(callback);
  }
  touch(id, value, callback = () => {}) { this.set(id, value, callback); }
}

export async function audit(connection, actor, action, subject = null) {
  await connection.execute('INSERT INTO audit_events(actor_id,action,subject_id) VALUES(?,?,?)', [actor, action, subject]);
}
