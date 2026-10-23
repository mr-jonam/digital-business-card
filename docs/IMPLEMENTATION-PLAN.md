# Piano di implementazione e verifica

Questo piano precede il codice. Non trasformare le caselle previste in risultati eseguiti.

## Ordine di costruzione

| Milestone | Consegna | Verifica di uscita |
| --- | --- | --- |
| 1. Fondazione | Versioni bloccate, scaffold Laravel, DB MySQL, `.env.example`, auth e admin bootstrap | Avvio locale, migration da zero, test auth/sessioni e dipendenze compatibili |
| 2. Profilo pubblico | CRUD bozza, link, policy ownership, snapshot e pubblicazione | Nessuna bozza pubblica; test autorizzazioni, conflitti e rollback pubblicazione |
| 3. Scambio contatto | vCard, QR PNG/SVG, pagina Condividi e firma email | Decodifica QR reale, parsing/import vCard, share e fallback browser |
| 4. Team e marchio | Contesti, assegnazioni, branding, sospensione, stato editor | Dati demo neutri, contrasto, revoca su tutti gli endpoint e interazioni accessibili |
| 5. Hardening e VM | Config Apache, pacchetto release, ACL, backup/restore e runbook eseguibile | Test su VM Windows target, HTTPS/rinnovo, riavvio, recovery e rollback |
| 6. GitHub | Repository pubblica, README bilingue se utile, avvisi dipendenze e provenienza aggiornata | Scan segreti/storia, licenze compatibili, commit verificato e link repository |

Ogni milestone produce una commit in scope dopo la verifica. Preparare test prima o insieme alla funzionalità che protegge; evitare test che copiano soltanto l'implementazione. Nessun deploy o servizio Azure viene attivato dalla progettazione.

## Contratti da testare

| Area | Caso essenziale | Esito atteso |
| --- | --- | --- |
| Pubblicazione | Modifica bozza di scheda attiva | Pubblico invariato fino a Pubblica |
| Atomicità | Generazione vCard fallisce | Vecchia revisione disponibile e nessun artefatto parziale |
| Concorrenza | Due editor salvano la stessa versione | Conflitto esplicito; nessuna sovrascrittura silenziosa |
| Ownership | Editor cambia ID di profilo/card/media | Accesso negato; nessuna informazione di un altro profilo |
| Autenticazione | Login, logout, scadenza, reset, TOTP | Sessioni corrette, rate limit, CSRF e recupero sicuro |
| Dati pubblici | Campo nascosto nel contesto | Assente da HTML, metadati, vCard e anteprima pubblica |
| Revoca | Profilo sospeso con URL/file già noti | Tutti gli endpoint controllati negano dati; copie salvate restano fuori controllo |
| Link | `javascript:`, CR/LF, credenziali o URL privato | Rifiuto; nessun fetch server della destinazione |
| Upload | File camuffato, SVG o immagine enorme | Rifiuto sicuro, nessuna esecuzione e nessun path controllato dal client |
| vCard | Accenti, emoji nei dati utente, separatori e righe lunghe | UTF-8/CRLF/escape/folding corretti e import leggibile |
| QR | Export PNG/SVG e URL permanente | Decoder indipendente restituisce URL esatto; prove su stampa e schermo |
| Aggiornamento | Profilo ripubblicato dopo stampa QR | Stesso URL, dati nuovi online; rubrica precedente invariata |
| Contesti | Due selezioni link con stesso profilo | Ogni QR porta alla selezione prevista; nessun leak fra contesti |
| Share | API presente, assente, rifiutata o annullata | Menu supportato oppure link/download; feedback corretto |
| Email | Sistema senza client email | Link copiabile; nessun invio server o allegato promesso |
| Firma | Outlook desktop/web e Gmail | Testo/link leggibili anche con immagini bloccate |
| Interfaccia | 320–1440 px, tastiera, zoom e reduced-motion | Reflow, focus, label e azioni accessibili |
| Resilienza | JS disattivato, DB indisponibile, errore SMTP | Scheda server-rendered quando possibile; errori chiari, niente segreti |
| Deploy | Riavvio VM e recupero da backup | Servizi attivi senza login utente e dati recuperabili |

## Strategia di verifica proporzionata

Unit: serializer vCard, validatore URL/colore e snapshot dei campi pubblici. Feature su MySQL: autorizzazioni, publish, revoca, conflitti e autenticazione. Evitare di affidare le sole prove transazionali a SQLite, che non riproduce tutti i comportamenti MySQL.

Browser: flusso completo admin → pubblicazione → visita mobile → download → sospensione, con controllo console/rete e fallback di condivisione. Validazione automatica accessibilità più verifica manuale tastiera/focus. I menu nativi di condivisione, l'import nelle rubriche e la scansione fisica richiedono anche dispositivi reali.

Sicurezza: review del codice che riceve input e gestisce auth/upload, dipendenze e configurazione. Prestazioni: un solo test rappresentativo con dispositivo, rete, VM e dataset dichiarati; ripetere solo per modifiche o risultati non conformi.

Gli esiti vanno registrati in un report futuro con commit, ambiente, comandi e limitazioni. Non confondere screenshot di un mockup con test UI dell'applicazione.

## Criteri di prontezza

**Pronto per una demo locale** quando un clone pulito può avviarsi con dati fittizi e completare profilo, pubblicazione, QR e vCard; README e comando di bootstrap devono bastare senza password predefinite.

**Pronto per deploy pilota** quando i controlli funzionali/sicurezza passano e il pacchetto viene installato sulla VM Windows target con HTTPS, ACL, SMTP, backup, restore e rollback verificati. Le funzioni non provate su telefono devono essere dichiarate, non considerate implicitamente supportate.

**Pronto per utilizzo operativo** quando dominio, informativa, recapiti pubblicabili, amministratori, TOTP, retention e responsabilità operative sono definiti; import/share verificati sui dispositivi concordati e nessun difetto bloccante di accessibilità, sicurezza o perdita dati rimane aperto.

**Pronto per GitHub pubblico** quando sono assenti dati personali/aziendali nei contenuti di prodotto e nella storia, sono presenti licenza/NOTICE e avvisi di terzi, provenienza coerente e documentazione di installazione verificata. Le informazioni amministrative del manutentore e i canali di sostegno approvati restano separati dal prodotto.

Stato attuale di tutte queste soglie: **non raggiunto; design e blueprint disponibili**.

## Verifiche del pacchetto di progettazione

Eseguite il 23 ottobre 2026: parsing XML del disegno SVG, rendering PNG 1920 × 1280 e ispezione visiva; risoluzione degli 11 collegamenti Markdown locali presenti; confronto SHA-256 del testo Apache-2.0 scaricato dalla fonte ufficiale; ricerca mirata di riferimenti aziendali/personali e pattern comuni di segreti nei documenti e nel disegno.

Contrasto calcolato: bianco su accento `#17614D` 7.36:1; testo `#182B27` su sfondo `#F6F8F7` 13.93:1; testo secondario `#52645E` sullo stesso sfondo 5.89:1. Questi controlli riguardano il design base e non attestano conformità WCAG dell'applicazione futura o di qualsiasi colore personalizzato.

Nessun test funzionale, browser o VM è stato eseguito: il progetto non contiene ancora codice applicativo. Il QR disegnato è un segnaposto dichiarato, non un codice funzionante.

## Decisioni per il kickoff

Si può iniziare lo sviluppo con localhost, database e SMTP di test, dati fittizi e marchio neutro. Dominio reale, VM e recapiti non sono prerequisiti per lo scaffold.

Prima del pilota servono dominio/IP, accesso amministrativo alla VM autorizzato, SMTP, dati pubblicabili, responsabili e destinazione backup. Per firma/provenienza cifrata servono chiavi controllate dall'utente; non generare né archiviare chiavi private nella repository.

Licenza Apache-2.0 e canali di sostegno sono già confermati. Nessun workflow GitHub Actions è previsto ora; se successivamente necessario, proporre un test-only con permessi minimi, azioni fissate a SHA e nessun deploy automatico o servizio a pagamento.
