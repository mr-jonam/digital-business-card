> Documento storico di progettazione (23 ottobre 2026). Dal 26 ottobre lo stack implementato è Node.js 22+/Express/EJS/MySQL. Per funzioni attuali e deploy usare README.md e docs/UBUNTU-DEPLOY.md; le parti Laravel/Windows e le funzioni future qui descritte non sono la procedura corrente.

# Deployment previsto: Azure VM Windows, Apache e MySQL

**Runbook progettuale.** Da completare e provare quando esisterà l'applicazione. Non attesta un deploy riuscito e non autorizza la creazione di risorse Azure, segreti, record DNS, certificati o abbonamenti. Nessun comando seguente è stato eseguito su una VM.

## 1. Topologia raccomandata

Una VM Windows Server supportata ospita Apache/PHP e MySQL 8.4 LTS. Solo HTTPS è pubblico; HTTP serve per redirect e, se scelto, ACME HTTP-01. MySQL ascolta su `127.0.0.1`. Accesso amministrativo attraverso rete privata/VPN o canale già disponibile; mai RDP aperto a Internet. Azure Bastion è un'opzione a pagamento, non un prerequisito da attivare automaticamente.

Disco e storage backup cifrati, destinazione backup fuori VM e credenziali separate. Una singola VM è un punto di guasto: non è un'architettura ad alta disponibilità. Backup e monitoraggio riducono il rischio, non eliminano l'interruzione.

Prima di procedere servono: dominio posseduto e durevole, regione/sizing/costi approvati, IP e DNS, amministratori, SMTP, policy di backup, responsabile privacy e finestra di manutenzione. La perdita del dominio rende inutilizzabili anche i QR già stampati.

## 2. Software e account

- Windows Server x64 con aggiornamenti e sincronizzazione oraria.
- Apache 2.4 Windows x64 aggiornato, provenienza e checksum verificati. Apache non distribuisce direttamente binari Windows ufficiali: scegliere una distribuzione mantenuta e verificarne le condizioni.
- PHP 8.4 NTS x64 con runtime Visual C++ richiesto; integrare via `mod_fcgid`/FastCGI. Non mescolare PHP NTS con `mod_php`.
- Estensioni Laravel e librerie scelte: includere almeno PDO MySQL, mbstring, OpenSSL, fileinfo, intl e GD; congelare elenco e requisiti al build.
- MySQL 8.4 LTS installato come servizio Windows; bind locale e utenti separati.
- Composer sul sistema di build o sulla VM per installazione controllata. Node solo nel build se necessario; asset compilati consegnati con la release.
- Identità di servizio con privilegi minimi per Apache/PHP; MySQL con account distinto. Nessun processo applicativo come Administrator/LocalSystem salvo requisito verificato.
- SMTP autenticato TLS già approvato. Il pulsante Via email apre il client dell'utente; SMTP serve a inviti e recupero account.

Per sviluppo usare dati fittizi. `php artisan serve` è ammesso solo in locale e non è il server di produzione. Una distribuzione all-in-one da sviluppo non costituisce automaticamente una base di produzione mantenuta.

## 3. Struttura Windows prevista

```text
C:\apps\digital-card\releases\<release-id>\  codice e vendor di una release
C:\apps\digital-card\shared\config\.env     configurazione privata
C:\apps\digital-card\shared\storage\       media, revisioni e log
C:\apps\digital-card\current\               puntatore/junction alla release attiva
C:\Apache24\conf\extra\digital-card.conf    virtual host
C:\secure\tls\                              certificati; chiavi accessibili al servizio
```

La procedura di pacchettizzazione dovrà collegare in modo verificato `.env` e `storage` condivisi alla release. Le junction e le ACL vanno provate con l'identità di servizio Windows; evitare di sostituire directory attive alla cieca. `bootstrap/cache` è scrivibile per la singola release. Nessun backup o dump sotto `public`.

## 4. Configurazione applicativa prevista

Esempio concettuale `.env`, con segreti da generare e conservare fuori Git:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://cards.example.org
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=digital_card
DB_USERNAME=digital_card_app
DB_PASSWORD=<segreto-esterno>
SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
MAIL_MAILER=smtp
```

`APP_KEY` sarà generata una sola volta per l'installazione con lo strumento framework e conservata separatamente nei backup. Non rigenerarla a ogni release: cifra dati sensibili e sessioni. La configurazione SMTP reale e le variabili esatte dipendono dalla versione scelta. Usare `DB_HOST=127.0.0.1` per evitare ambiguità socket/named pipe.

Creare database `utf8mb4` e account con privilegi minimi. L'account dell'app non deve poter creare utenti, accedere ad altri schemi o leggere file del server. Migrazioni con credenziali temporanee separate; non conservare quelle amministrative nell'ambiente applicativo.

## 5. Contratto Apache

Il virtual host dovrà rispettare questi requisiti; il file pronto da copiare verrà prodotto e testato durante l'implementazione:

| Elemento | Valore/comportamento |
| --- | --- |
| ServerName | Dominio canonico verificato, es. `cards.example.org` |
| DocumentRoot | Solo `C:/apps/digital-card/current/public` |
| Directory listing | Disabilitato |
| Routing | Richieste non corrispondenti a file pubblici verso `public/index.php` |
| PHP | Handler FastCGI con `php-cgi.exe` NTS; timeout e pool dimensionati |
| TLS | Certificato pubblico valido, catena completa e protocolli supportati aggiornati |
| HTTP | Redirect verso HTTPS; eventuale eccezione solo challenge ACME necessaria |
| Accesso | Nega file nascosti, config, sorgenti privati e backup anche se copiati per errore |
| Upload | Servizio media applicativo; nessuna esecuzione PHP nei file caricati |
| Header | Nosniff, policy frame/CSP/referrer; un solo punto di responsabilità per evitare duplicati |
| Host sconosciuti | Default virtual host restrittivo; niente fallback al profilo reale |

Abilitare solo i moduli necessari, inclusi quelli per rewrite, SSL e FastCGI scelto. Verificare sintassi con `httpd.exe -t` prima del reload. L'eventuale `FallbackResource` e le regole `.htaccess` dipendono dalla strategia scelta: non combinare ricette parziali senza testare asset, rotte e 404.

Certificato: definire il metodo ACME supportato su Windows, account e salvataggio chiavi; es. win-acme con rinnovo tramite Windows Task Scheduler e reload Apache dopo sostituzione riuscita. Il solo rilascio iniziale non basta: simulare rinnovo e monitorare scadenza. Eventuali costi DNS, certificati o servizi richiedono approvazione.

## 6. Primo rilascio, sequenza da validare

1. Costruire un pacchetto da commit identificabile: dipendenze bloccate, avvisi di licenza, asset locali compilati, niente demo/segreti, checksum del pacchetto.
2. Eseguire test e scansione delle dipendenze; confrontare i prerequisiti del pacchetto con PHP/estensioni della VM.
3. Installare il pacchetto in una nuova directory `releases`, senza toccare il codice attivo.
4. Predisporre `.env`, `APP_KEY`, storage, ACL e account DB. Verificare che il servizio possa leggere config e scrivere solo nelle directory previste.
5. Effettuare backup prima delle migration; per la prima installazione verificare schema vuoto e piano di rollback.
6. Eseguire migration con account dedicato. I comandi Laravel previsti comprendono `php artisan migrate --force`; il comando non esiste ancora in questo repository.
7. Preparare config/view cache secondo la major scelta; comandi previsti `php artisan config:cache` e `php artisan view:cache`. Evitare cache generate con `.env` sbagliato.
8. Creare primo admin tramite comando CLI da implementare, input segreto interattivo e cambio password/TOTP obbligatori. Nessuna password nei parametri shell, nella documentazione o nei seed.
9. Configurare virtual host e HTTPS; `httpd.exe -t`; aprire solo le porte NSG/Windows Firewall previste. Non aprire 3306 al pubblico.
10. In finestra controllata attivare il puntatore `current`, riavviare/riciclare Apache e PHP per evitare cache OPcache della vecchia release, verificare la salute.
11. Eseguire smoke test pubblico e gestionale, QR fisico, import vCard, email reset e sospensione. Conservare la release precedente e il backup verificato.
12. Configurare e provare backup, pulizia retention, rinnovo TLS e monitoraggio. Registrare operatore, commit e risultato dei controlli.

Niente worker o coda persistente nell'MVP: email gestionali a basso volume sincrone con timeout, invito/reset recuperabili e messaggio non enumerabile. Se la latenza non passa i criteri, introdurre una coda e il relativo servizio Windows prima della produzione. Non lasciare job che nessun processo consumerà.

## 7. Backup e ripristino

Obiettivi proposti da approvare: RPO 24 ore, RTO 4 ore. Per ottenerli serve un backup giornaliero e una prova di ripristino su ambiente separato; la sola presenza dei file non dimostra il recupero.

Backup coerente di MySQL InnoDB con snapshot/dump transazionale, media e revisioni pubblicate, `.env`/APP_KEY, configurazione Apache e riferimenti ai certificati. Controllare che migrazioni, pubblicazioni e filesystem non producano snapshot incoerenti; usare una breve finestra controllata se necessaria. Non passare password in chiaro nella riga di comando dei dump.

Cifrare i backup, salvarli fuori VM con ACL e credenziali distinte, retention proposta 14 giornalieri + 4 settimanali e verifica periodica del ripristino. La scelta del servizio Azure o di altro storage dipende dai costi approvati. Non esportare backup nella repository GitHub.

## 8. Aggiornamenti e rollback

Per ogni update: test → backup → release nuova → migration compatibili → attivazione controllata → smoke test. Preferire migration additive; una colonna distrutta non riappare passando al vecchio codice.

Rollback del codice: ripuntare alla release precedente in manutenzione e riciclare PHP/Apache, solo se lo schema è compatibile. Rollback di schema/dati: piano provato e, se necessario, ripristino completo coerente, dichiarando la perdita di dati successiva all'RPO. Non promettere deploy senza interruzione con il semplice cambio di junction su Windows.

## 9. Verifiche finali sulla VM

- HTTPS, catena, redirect, rinnovo e host consentiti.
- Nessun accesso HTTP a `.env`, log, storage privato, migration, dump o backup.
- Creazione profilo → bozza → pubblicazione → modifica → sospensione, con separazione fra utenti.
- HTML/vCard coerenti, QR decodificato sul telefono e import in almeno iOS/Android/Outlook.
- Reset password e recupero TOTP verificati senza account predefiniti condivisi.
- Database non raggiungibile da Internet; account app senza privilegi amministrativi.
- Riavvio VM: servizi ripartono e il sito è raggiungibile senza sessione utente aperta.
- Ripristino da backup, monitoraggio spazio/servizi/TLS e rollback della release provati.

## Fonti da verificare al congelamento delle versioni

- Laravel deployment: https://laravel.com/docs/deployment
- PHP Windows: https://windows.php.net/ e https://www.php.net/manual/en/install.windows.php
- Apache Windows: https://httpd.apache.org/docs/2.4/platform/windows.html
- MySQL 8.4: https://dev.mysql.com/doc/refman/8.4/en/windows-installation.html
- Azure Windows VM: https://learn.microsoft.com/en-us/azure/virtual-machines/windows/
- win-acme: https://www.win-acme.com/manual/automatic-renewal
