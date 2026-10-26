import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { createMailer, deliverOne, purge } from './delivery.js';

const config = loadConfig(), pool = createPool(config.databaseUrl), mailer = createMailer(config);
let stopped = false, lastPurge = 0;
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => { stopped = true; });
console.log(mailer ? 'Worker notifiche attivo.' : 'SMTP non configurato: richieste conservate, notifiche in attesa.');
while (!stopped) {
  try {
    if (Date.now() - lastPurge > 3600000) { await purge(pool, config.privacy.retention); lastPurge = Date.now(); }
    const processed = await deliverOne(pool, config, mailer);
    if (!processed) await new Promise(resolve => setTimeout(resolve, 3000));
  } catch { console.error('Worker: operazione fallita, nuovo tentativo tra 10 secondi.'); await new Promise(resolve => setTimeout(resolve, 10000)); }
}
mailer?.close();
await pool.end();
