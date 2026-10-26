# Digital Business Card

Web app self-hosted per biglietti da visita, QR e richieste di ricontatto. Un’installazione ospita più profili; marchio, recapiti e foto sono configurati fuori dal repository. Nessun servizio QR a pagamento o CDN richiesto.

**MVP implementato e testato localmente il 26 ottobre 2026.** Il deploy su una VM reale, le credenziali SMTP e l’importazione nella rubrica iOS/Android richiedono un collaudo nell’ambiente di destinazione.

## Funzioni

- Schede pubbliche con foto o iniziali, nome, ruolo, telefono facoltativo, LinkedIn e siti.
- CTA principale «Lascia i tuoi contatti»: email e/o telefono, conservati nel pannello e notificati tramite coda SMTP. Form messaggio senza mailto; email del titolare esclusa da HTML pubblico, QR e vCard.
- Pannello amministratore/editor, assegnazione profili, bozze, pubblicazione esplicita, URL permanenti e sospensione.
- QR pagina aggiornabile e QR contatto con vCard incorporata offline; PNG/SVG, due colori di scansione sicuri.
- Pulsante contatto con risposta vCard inline. Il sistema operativo decide se aprire la rubrica o scaricare: nessuna API web può garantire un salvataggio diretto universale. I QR contatto già distribuiti non si aggiornano né si revocano.
- Temi, colori corretti per il contrasto, artwork QA, riflessi metallici casuali, profondità e griglia reattiva; touch e movimento ridotto disattivano il movimento.
- Login, TOTP obbligatorio per amministratori, sessioni MySQL, CSRF, limitazione tentativi, foto ricodificate senza metadati, retention e audit.

## Stack e avvio locale

Node.js **22.13+**, Express 5, EJS, MySQL 8.0+, CSS/JavaScript/Canvas. Le dipendenze sono bloccate nel lockfile. Nessuna compilazione React/PHP.

1. Creare un database MySQL locale dedicato e un’utenza con permessi di migrazione.
2. Copiare `.env.example` in `.env`; impostare DATABASE_URL, SESSION_SECRET casuale e PUBLIC_ORIGIN. Per usare i form compilare i tre campi privacy con i dati effettivi. Non usare credenziali di produzione per i test.
3. Eseguire:

```sh
npm ci
npm run migrate
npm run user:add -- --email admin@example.org
npm start
```

Il comando account mostra una password casuale: conservarla privatamente. Aprire `http://127.0.0.1:3600/admin`, associare Authenticator e creare/pubblicare i profili. In un secondo terminale eseguire `npm run worker` per SMTP e retention. Su Windows utilizzare `npm.cmd` se PowerShell blocca npm.ps1.

La produzione usa un’utenza MySQL limitata a SELECT/INSERT/UPDATE/DELETE; l’installatore applica lo schema attraverso il socket amministrativo locale. L’origine pubblica HTTPS deve essere definitiva prima di stampare i QR.

## Deploy Ubuntu / Azure

Seguire [la guida WinSCP e Ubuntu 24.04](docs/UBUNTU-DEPLOY.md). Generare il pacchetto con `npm run package:deploy`: include solo sorgenti e configurazione di esempio. Servizi systemd separati per web e worker, Apache reverse proxy, MySQL dedicato. La guida permette di affiancare un’altra app sotto `/dpp/`.

Logo e profili reali sono un pacchetto privato separato. Non caricare .env, database, storage, credenziali o loghi aziendali nella repository pubblica. Nessun deploy, workflow CI, abbonamento o release viene attivato automaticamente.

## Verifica

```sh
npm run check
npm test
npm audit --omit=dev
```

I test richiedono MySQL **locale** con permesso di creare/eliminare un database temporaneo. Impostare TEST_DATABASE_URL; in alternativa leggono DATABASE_URL dal .env locale. Il database indicato non viene svuotato: ogni esecuzione crea ed elimina un database `cards_test_*` dedicato. Il test browser usa Chrome/Edge installato su Windows, oppure Chromium di Playwright (`npx playwright install chromium`). SMTP di prova locale, nessun invio a caselle reali.

Copertura: autorizzazioni, CSRF, conflitti di modifica, snapshot pubblicati, decodifica indipendente dei QR, form e persistenza, idempotenza/outbox, invio e retry SMTP, enrollment TOTP, upload/pubblicazione foto via UI, sospensione e retention. UI verificata a 320/390 px, tastiera, dialoghi, modalità senza JS e controlli automatici Axe. Non equivale a una certificazione WCAG o a prove su telefoni reali.

`/health/live` verifica il processo; `/health/ready` verifica schema e configurazione privacy. Nessuno dei due certifica consegna SMTP, validità dell’informativa o integrazione con la rubrica.

## Documenti e licenza

Il README e la guida Ubuntu descrivono il software attuale. I blueprint e i disegni sotto docs conservano la progettazione iniziale: Laravel/Windows, schermate e funzionalità future presenti in quei documenti non costituiscono la procedura attuale.

Codice, template, documentazione e artwork originali: [Apache-2.0](LICENSE). Dipendenze e binari opzionali conservano le loro licenze: [NOTICE](NOTICE), [inventario e avvisi](THIRD-PARTY-NOTICES.md), [decisione e provenienza](LICENSE-DECISION.md). I marchi esterni non sono inclusi nella concessione.

I canali di sostegno già approvati sono in [.github/FUNDING.yml](.github/FUNDING.yml), indipendenti dal brand dell’app. Una repository pubblica consente visione e fork secondo i termini della piattaforma e i diritti della licenza.
