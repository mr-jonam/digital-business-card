# Deploy su Azure Ubuntu 24.04 con WinSCP

Applicazione reale Node.js 22+, Express e MySQL 8.0, con Apache davanti al servizio Node. Non serve PHP, non serve compilare React e non si usa la vecchia cartella `preview`. Il lead magnet può condividere la VM sotto `/dpp/`, sulla porta interna 3500; i biglietti occupano `/`, sulla porta interna 3600. Le due app hanno database e configurazioni separati.

Questa procedura parte dalla VM già preparata con Apache, MySQL, Node.js 22, utente di servizio `dppapp` e file `/etc/dpp-deploy-user`. I comandi si incollano nel portale Azure: **VM → Esegui comando → RunShellScript**. I blocchi usano Bash esplicito. Non occorre eseguire comandi dal PowerShell locale.

## 1. Prepara le cartelle per WinSCP

Esegui sulla VM:

```bash
bash <<'PREPARE'
set -euo pipefail
VM_USER="$(cat /etc/dpp-deploy-user)"
id "$VM_USER" >/dev/null
test "$VM_USER" != root
install -d -o "$VM_USER" -g "$(id -gn "$VM_USER")" -m 0700 /srv/dpp/uploads
install -d -o "$VM_USER" -g dppapp -m 2750 /srv/dpp/cards/app /srv/dpp/cards/brand
install -d -o dppapp -g dppapp -m 0700 /srv/dpp/cards/storage
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y unzip
node --version
systemctl is-active apache2 mysql
PREPARE
```

In WinSCP riconnettiti se la sessione era aperta prima dell’aggiunta del gruppo `dppapp`. Protocollo SFTP, porta 22, IP/DNS della VM e credenziali Linux già in uso. Usa trasferimento binario.

## 2. Carica i pacchetti

Nel PC il comando `npm run package:deploy` genera `dist/digital-card-app.tar.gz` e il relativo file SHA-256. Chi riceve un pacchetto già preparato non deve installare Node sul PC.

Con WinSCP carica in **`/srv/dpp/uploads`**:

- `digital-card-app.tar.gz` e `digital-card-app.tar.gz.sha256`;
- facoltativamente `digital-card-private.tar.gz`, consegnato separatamente: contiene loghi e profili reali, esclusi dal repository neutro. Trattalo come materiale riservato.

Non caricare `node_modules`, `.env`, `.git`, cache o il database del PC. Le dipendenze native delle immagini vengono installate direttamente su Linux.

Esegui sulla VM:

```bash
bash <<'EXTRACT'
set -euo pipefail
cd /srv/dpp/uploads
sha256sum -c digital-card-app.tar.gz.sha256
tar -xzf digital-card-app.tar.gz -C /srv/dpp/cards/app --no-same-owner
if test -f digital-card-private.tar.gz; then
  tar -xzf digital-card-private.tar.gz -C /srv/dpp/cards --no-same-owner
fi
VM_USER="$(cat /etc/dpp-deploy-user)"
chown -R "$VM_USER":dppapp /srv/dpp/cards/app /srv/dpp/cards/brand
chmod -R u=rwX,g=rX,o= /srv/dpp/cards/app /srv/dpp/cards/brand
if test -f /srv/dpp/cards/profiles.json; then
  chown "$VM_USER":"$(id -gn "$VM_USER")" /srv/dpp/cards/profiles.json
  chmod 0600 /srv/dpp/cards/profiles.json
fi
EXTRACT
```

## 3. Installa l’app e crea l’amministratore

Sostituisci `TUO_HOST` con il DNS completo della VM, senza protocollo o percorsi, e `EMAIL_LOGIN_AMMINISTRATORE` con l’email che vuoi usare per accedere. Il DNS deve puntare all’IP pubblico della VM; puoi usare anche l’etichetta DNS della risorsa IP pubblico Azure.

```bash
bash /srv/dpp/cards/app/deploy/install.sh 'TUO_HOST' 'EMAIL_LOGIN_AMMINISTRATORE'
```

Lo script crea il database `digital_cards`, un’utenza MySQL con soli permessi applicativi, la configurazione privata, l’amministratore iniziale e due servizi systemd. Non modifica il database del lead magnet. Non ricreare né cancellare manualmente l’utenza `cards_app` se ripeti l’installazione: lo script conserva la configurazione esistente.

Con l’editor WinSCP apri `/srv/dpp/config/cards-first-login.txt`: contiene la password iniziale. Conservala in un password manager; cambiala dal pannello dopo il primo accesso. Il recupero dell’account richiede l’accesso amministrativo alla VM: non è prevista un’email automatica di reset.

## 4. Configura privacy, brand e notifiche

Apri **`/srv/dpp/config/cards.env`** con l’editor WinSCP. È fuori dalla cartella web, con permessi 0600. Non incollare segreti in chat o nel portale come output.

Compila almeno:

```dotenv
PRIVACY_CONTROLLER='Titolare effettivo del trattamento'
PRIVACY_CONTACT='Recapito privacy pubblico'
PRIVACY_NOTICE='Testo approvato: finalità del ricontatto, base giuridica, eventuali destinatari o trasferimenti, diritti e modalità per esercitarli.'
RETENTION_DAYS=30
```

Usa una sola riga per variabile, con apici singoli se contiene spazi, `#` o caratteri speciali. Per evitare ambiguità tra Node e systemd, non usare apici singoli all’interno del valore: usa l’apostrofo tipografico `’`. Finché i tre campi privacy sono vuoti, i moduli restano disattivati e `/health/ready` restituisce 503.

Per il pacchetto privato imposta:

```dotenv
BRAND_FILE=/srv/dpp/cards/brand/brand.json
```

Per ricevere anche le notifiche email, configura un provider che supporti SMTP autenticato. Azure può limitare la porta 25: usa 587 con STARTTLS oppure 465 con TLS. Un account Microsoft 365 può avere SMTP con password disabilitato; in quel caso serve un relay/provider compatibile. Il solo indirizzo del destinatario non autorizza l’invio dal suo dominio.

```dotenv
SMTP_HOST=smtp.provider.example
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER='utenza-del-provider'
SMTP_PASSWORD='password-del-provider'
SMTP_FROM='mittente-verificato@example.org'
```

Verifica il mittente con il provider, inclusi SPF/DKIM dove richiesto. Il destinatario privato è definito nel profilo; l’email del visitatore viene usata solo come Reply-To. Senza SMTP le richieste vengono comunque salvate nell’area riservata e le notifiche restano in attesa. Quando configuri SMTP, il worker proverà a inviare anche quelle pendenti.

```bash
systemctl restart dpp-cards dpp-cards-worker
```

## 5. Importa i profili come bozze

Con il pacchetto privato, esegui:

```bash
bash <<'IMPORT'
set -euo pipefail
VM_USER="$(cat /etc/dpp-deploy-user)"
cd /srv/dpp/cards/app
runuser -u "$VM_USER" -- node --env-file=/srv/dpp/config/cards.env src/cli.js import --file /srv/dpp/cards/profiles.json
IMPORT
```

Ripetere il comando salta i profili già presenti. `--update` aggiorna invece le loro bozze: usarlo solo se vuoi sostituire le modifiche effettuate dal pannello. Senza pacchetto privato creerai i profili dal pannello.

## 6. Configura Apache e HTTPS

Apri sul Network Security Group Azure le porte **80 e 443**. Tieni 22 limitata al tuo IP; non esporre 3306, 3500 o 3600. Non serve un desktop Linux.

Per il primo deploy, se esiste soltanto il sito Apache predefinito o il precedente `dpp-platform.conf` di questa installazione, esegui il blocco qui sotto sostituendo `TUO_HOST`. **Se hai già un virtual host HTTPS per questo dominio, conserva certificati e direttive SSL: aggiorna soltanto ProxyPass e gli header come indicato dopo il blocco.**

```bash
bash <<'APACHE'
set -euo pipefail
SITE_HOST='TUO_HOST'
printf '%s\n' "$SITE_HOST" > /etc/dpp-site-host
a2enmod headers proxy proxy_http ssl rewrite
if test -f /etc/apache2/sites-available/dpp-platform.conf; then
  cp -a /etc/apache2/sites-available/dpp-platform.conf "/srv/dpp/backups/apache-before-cards-$(date +%Y%m%d-%H%M%S).conf"
fi
cat > /etc/apache2/sites-available/dpp-platform.conf <<EOF
<VirtualHost *:80>
    ServerName ${SITE_HOST}
    ProxyRequests Off
    ProxyPreserveHost On
    RequestHeader unset X-Forwarded-For
    RequestHeader unset X-Forwarded-Host
    RequestHeader set X-Forwarded-Proto "http"
    RedirectMatch 302 ^/dpp$ /dpp/
    ProxyPass        /dpp/ http://127.0.0.1:3500/dpp/ retry=0 timeout=120
    ProxyPassReverse /dpp/ http://127.0.0.1:3500/dpp/
    ProxyPass        / http://127.0.0.1:3600/ retry=0 timeout=30
    ProxyPassReverse / http://127.0.0.1:3600/
    LimitRequestBody 3145728
    ErrorLog \${APACHE_LOG_DIR}/dpp-error.log
    CustomLog \${APACHE_LOG_DIR}/dpp-access.log combined
</VirtualHost>
EOF
a2dissite 000-default || true
a2ensite dpp-platform
apache2ctl configtest
systemctl reload apache2
certbot --apache -d "$SITE_HOST" --redirect
APACHE
```

Certbot richiede un’email e l’accettazione dei termini. Se Run command non consente la risposta interattiva, esegui dal terminale di WinSCP/PuTTY `sudo certbot --apache -d TUO_HOST --redirect`, oppure passa `--non-interactive --agree-tos -m TUA_EMAIL` solo dopo aver accettato i termini del servizio.

Nel file HTTPS creato da Certbot, normalmente `/etc/apache2/sites-available/dpp-platform-le-ssl.conf`, controlla con WinSCP che:

- le due regole `/dpp/` vengano **prima** delle regole `/`;
- sia presente `RequestHeader set X-Forwarded-Proto "https"` nel virtual host 443. Certbot può avere copiato il valore `http`: correggilo;
- le direttive SSL e i percorsi dei certificati restino presenti.

Poi esegui `apache2ctl configtest` e `systemctl reload apache2`. Il servizio accetta sessioni amministrative in produzione solo tramite HTTPS. I sorgenti e il file di configurazione non devono diventare DocumentRoot: Apache inoltra le richieste a Node. Il vecchio contenuto di `/srv/dpp/cards/public` non viene più utilizzato.

## 7. Primo accesso, pubblicazione e QR

Apri **`https://TUO_HOST/admin`**. Accedi con l’email scelta e la password del file privato. Al primo accesso è obbligatorio associare un’app Authenticator e confermare il codice a sei cifre. Cambia la password e conserva l’accesso alla VM per il recupero.

Nel pannello apri ciascun profilo, controlla i dati e l’email riservata, carica eventualmente la foto, **Salva bozza**, controlla **Anteprima bozza**, poi **Pubblica la bozza salvata**. Le modifiche non diventano pubbliche fino alla pubblicazione.

La sezione **QR e condivisione** offre PNG/SVG e copia/condivisione del link:

- **QR pagina**: URL permanente `/c/ID_CASUALE`, aggiornabile ripubblicando il profilo. È la scelta consigliata per stampa e NFC.
- **QR contatto**: dati vCard incorporati, senza email privata. Le copie già stampate non si aggiornano e non si possono revocare.

Il pulsante della scheda apre una risposta vCard con disposizione `inline`, senza forzare un download. iOS e Android possono comunque comportarsi diversamente: il sito non può scrivere direttamente nella rubrica. Il collaudo su telefoni reali resta necessario.

Le richieste sono visibili in **Richieste ricevute**, con stato della notifica e possibilità di ritentare o cancellare. Puoi aggiungere editor tramite CLI e assegnare loro i profili dal pannello amministratore:

```bash
bash <<'EDITOR'
set -euo pipefail
VM_USER="$(cat /etc/dpp-deploy-user)"
cd /srv/dpp/cards/app
umask 077
runuser -u "$VM_USER" -- node --env-file=/srv/dpp/config/cards.env src/cli.js user:add --email 'EMAIL_EDITOR' --role editor > /srv/dpp/config/cards-editor-login.txt
chown "$VM_USER":"$(id -gn "$VM_USER")" /srv/dpp/config/cards-editor-login.txt
EDITOR
```

## 8. Verifica dopo il deploy

```bash
systemctl is-active apache2 mysql dpp-cards dpp-cards-worker
curl -fsS http://127.0.0.1:3600/health/live
curl -fsS http://127.0.0.1:3600/health/ready
journalctl -u dpp-cards -u dpp-cards-worker --since '10 minutes ago' --no-pager -n 40
```

Apri il sito HTTPS da PC e smartphone. Invia una richiesta con un recapito di test, verifica che compaia nel pannello e, se SMTP è attivo, che arrivi la notifica. Inquadra il QR da un altro telefono, prova aggiunta contatto e tastiera. La verifica health non garantisce recapito SMTP né salvataggio in rubrica. La consegna email usa tentativi con attesa e può eccezionalmente duplicarsi se il processo termina dopo l’accettazione SMTP ma prima della conferma nel database.

Verifica anche `https://TUO_HOST/dpp/` e il suo percorso amministrativo. Se il lead magnet non è ancora installato, solo `/dpp/` restituirà 503: i biglietti funzionano in modo indipendente. Mantieni l’accesso pubblico limitato durante il collaudo.

## 9. Backup, aggiornamenti e recupero

Esegui backup prima di aggiornare. Il database contiene destinatari, richieste e segreti TOTP cifrati; anche `cards.env`, inclusa SESSION_SECRET, è necessario per ripristinare gli account. Non pubblicare questi file e proteggi i backup come dati personali.

```bash
bash <<'BACKUP'
set -euo pipefail
umask 077
STAMP="$(date +%Y%m%d-%H%M%S)"
mysqldump --single-transaction --no-tablespaces digital_cards | gzip > "/srv/dpp/backups/cards-${STAMP}.sql.gz"
tar -czf "/srv/dpp/backups/cards-files-${STAMP}.tar.gz" -C /srv/dpp config/cards.env cards/storage cards/brand
VM_USER="$(cat /etc/dpp-deploy-user)"
chown "$VM_USER":"$(id -gn "$VM_USER")" /srv/dpp/backups/cards-*
BACKUP
```

Scarica i backup con WinSCP e conservali cifrati fuori dalla VM. Definisci anche la loro scadenza e quella delle notifiche nella casella email: la cancellazione automatica di 30 giorni riguarda il database dell’app. Prova il ripristino su un database separato prima di affidarti al backup.

Per un aggiornamento: backup, conserva una copia della cartella app precedente, arresta `dpp-cards` e `dpp-cards-worker`, carica/estrai il nuovo pacchetto e riesegui `install.sh` con lo stesso host. Conserva configurazione, storage e brand. Questa prima versione ha soltanto lo schema iniziale: future migrazioni devono includere istruzioni specifiche. Un rollback del codice non annulla migrazioni del database.

Se perdi l’Authenticator o la password, l’amministratore VM può eseguire `src/cli.js user:reset --email EMAIL --reset-totp`, caricando `cards.env` come nei blocchi precedenti e reindirizzando l’output a un file privato 0600. L’operazione chiude le sessioni; l’utente dovrà associare nuovamente l’Authenticator. Non cambiare SESSION_SECRET per recuperare un solo account.

Dopo aver conservato la password nel password manager e completato il cambio, elimina con WinSCP i file `cards-first-login.txt` e `cards-editor-login.txt`. Elimina anche i pacchetti privati dalla cartella uploads quando non servono più.
