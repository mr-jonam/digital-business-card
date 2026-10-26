import { mkdir } from 'node:fs/promises';
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { createApp } from './app.js';

const config = loadConfig();
await mkdir(config.storage, { recursive: true });
const pool = createPool(config.databaseUrl);
await pool.execute('SELECT id FROM profiles LIMIT 1');
const app = await createApp(pool, config);
const server = app.listen(config.port, config.host, () => console.log(`Digital Card running at ${config.host}:${config.port}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => {
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 15000).unref();
});
