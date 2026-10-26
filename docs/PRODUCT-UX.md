> Documento storico di progettazione (23 ottobre 2026). Dal 26 ottobre lo stack implementato è Node.js 22+/Express/EJS/MySQL. Per funzioni attuali e deploy usare README.md e docs/UBUNTU-DEPLOY.md; le parti Laravel/Windows e le funzioni future qui descritte non sono la procedura corrente.

# Prodotto, esperienza e design

Specifica proposta, 23 ottobre 2026. Nessuna funzione descritta è già implementata.

## 1. Obiettivo

Consentire a una persona di presentarsi, condividere i propri link professionali e trasferire un contatto in pochi passaggi, attraverso un URL e un QR che restano utilizzabili quando i contenuti cambiano.

Destinatari: piccole organizzazioni e team che gestiscono più profili sul proprio dominio. Il visitatore non crea account, non installa app e non deve fornire i propri dati.

## 2. Perimetro MVP

| Incluso | Criterio concreto |
| --- | --- |
| Scheda pubblica | Nome, ruolo, organizzazione, immagine opzionale, bio breve, email e telefono opzionali |
| Collegamenti | Più siti, LinkedIn e altri link HTTPS con titolo e ordine configurabili |
| Contatto | Download vCard 3.0 UTF-8 e condivisione file quando supportata |
| QR permanente | URL corto su dominio proprio; esportazione PNG/SVG con area di rispetto |
| Condivisione | QR a schermo, link, copia collegamento, condivisione nativa e bozza email |
| Firma email | Snippet HTML semplice, alternativa testo e istruzioni per Outlook/Gmail |
| Gestione | Login, ruoli, elenco profili, bozza, anteprima privata e pubblicazione esplicita |
| Marchio | Logo opzionale, nome organizzazione, un accento, metadati e dominio configurabili |
| Contesti | Un biglietto generale e varianti con selezione/ordine differente dei link |
| Revoca | Sospensione di tutti i biglietti di una persona e risposta pubblica senza dati |

Esclusi dall'MVP: Wallet, NFC, sincronizzazione rubrica, acquisizione lead, CRM, analytics per persona, app native, AI, import massivi, editor HTML libero, abbonamenti, multi-tenancy SaaS e modalità offline completa. Nessun certificato o account Wallet viene acquistato o creato.

## 3. Ruoli

- **Visitatore:** legge la versione pubblicata, scarica il contatto e condivide il link.
- **Editor:** aggiorna e pubblica solo i profili assegnati, usando un modello di marchio imposto dall'amministratore.
- **Amministratore:** gestisce utenti, assegnazioni, profili, marchio, dominio e sospensione. Le modifiche di dominio richiedono un'operazione infrastrutturale guidata.

Una persona descritta in un profilo non deve necessariamente avere un account. Un utente può gestire più profili. Autorizzazioni e assegnazioni sono controllate dal server.

## 4. Architettura dell'informazione

```text
Pubblico
  /c/{id}              Biglietto generale o contestuale
  /c/{id}/contact.vcf   Contatto corrispondente ai soli campi pubblicati

Gestione
  Profili → Editor → Anteprima → Pubblica
          → Condividi → QR / Link / vCard / Firma email
  Impostazioni → Marchio / Utenti / Installazione
```

L'area di gestione non è esposta nell'interfaccia pubblica. La landing marketing di un prodotto SaaS non è necessaria per usare il sistema.

## 5. Flussi principali

### Incontro dal vivo

Il titolare apre Condividi e mostra un QR grande con nome del contesto. Il destinatario inquadra, apre la scheda e sceglie Salva contatto. Il dispositivo scarica o apre il file; la conferma finale nella rubrica appartiene al sistema operativo. Il sito mostra «File contatto pronto», mai «Contatto salvato» senza poterlo verificare.

La scheda deve essere leggibile anche con connessione lenta. Il QR non contiene direttamente tutti i recapiti: contiene il collegamento permanente. Per aprire o aggiornare la scheda serve rete. Un file vCard già scaricato resta condivisibile dal telefono anche senza rete.

### Condivisione a distanza

Da Condividi, il titolare usa il menu nativo del dispositivo, Copia link o Via email. La funzione email apre una bozza nell'app disponibile e non invia messaggi dal server. Senza client configurato, la UI propone Copia link. Una pagina web non può allegare una vCard a un `mailto:` in modo interoperabile: l'allegato si aggiunge manualmente oppure si usa la condivisione file nativa supportata.

`navigator.share` richiede HTTPS e compatibilità del browser. Se la condivisione file non è supportata, offrire download vCard e link. Se l'utente annulla il menu nativo, non mostrare un errore di sistema. Senza Clipboard API, selezionare il link per la copia manuale.

### Aggiornamento del profilo

L'editor modifica una bozza e vede un'anteprima privata. Salva bozza non modifica il pubblico. Prima della pubblicazione vede i campi che saranno visibili e il contesto interessato. Pubblica sostituisce atomicamente la revisione pubblica e rigenera vCard/QR necessari. Il vecchio contenuto resta attivo se la procedura fallisce.

Il QR già stampato continua a puntare allo stesso biglietto. Un contatto precedentemente importato nella rubrica non si aggiorna automaticamente.

### Biglietto per contesto

Il contesto Generale è creato con il profilo. Un editor può aggiungere Evento o Progetto, riordinare/nascondere link e scegliere quali recapiti pubblicare. I dati base si ereditano dal profilo; non si duplicano nome, telefono e ruolo. Ogni contesto ha un proprio ID permanente e una propria revisione pubblicata. Gli editor vedono un avviso quando un aggiornamento del profilo richiede di ripubblicare i contesti.

Il QR generale non cambia destinatario in base a posizione, tracciamento o regole nascoste: il contesto è scelto esplicitamente prima della condivisione.

### Sospensione e uscita dal team

Un amministratore sospende il profilo con conferma. Tutte le pagine, le vCard e le esportazioni pubbliche del profilo smettono di esporre dati; la pagina dice «Biglietto non disponibile». Gli ID non vengono riassegnati. I file già copiati o i contatti già salvati non possono essere ritirati da remoto.

## 6. Schermate

### A. Scheda pubblica, priorità smartphone

Ordine: marchio discreto, identità, ruolo e organizzazione, bio breve, Salva contatto, azioni email/telefono, lista link, Condividi e privacy. I campi assenti non creano spazi vuoti. Il pulsante principale resta facilmente raggiungibile senza coprire contenuti o controlli del browser.

Su desktop la scheda mantiene una colonna di lettura contenuta e può mostrare il QR a lato; sullo stesso smartphone il QR non sostituisce un collegamento cliccabile. I siti sono elencati con titolo e dominio visibile. LinkedIn è un link normale, senza SDK o login LinkedIn.

### B. Editor e anteprima

Desktop: navigazione compatta, form a sinistra e anteprima a destra. Sezioni Identità, Recapiti, Link e Contesti. Barra azioni con Salva bozza, Anteprima e Pubblica. Stato della bozza e data dell'ultima pubblicazione leggibili, senza confondere le due versioni.

Smartphone: form a colonna unica; l'anteprima è una schermata separata. Campi con label superiore, helper sul dato pubblico e messaggi di errore associati. Riordino link con pulsanti Sposta su/giù oltre all'eventuale drag-and-drop.

### C. Condividi

Mostra il contesto attivo, il QR su fondo bianco e l'URL leggibile. Azioni Mostra a schermo intero, Copia link, Condividi, Scarica QR, Scarica vCard e Firma email. Non alzare automaticamente la luminosità: il browser non offre una soluzione affidabile; un suggerimento può chiedere di aumentarla manualmente.

### D. Elenco e impostazioni

Elenco profili con ricerca, ruolo, stato pubblico, contesti e azioni accessibili. Nessun finto contatore di scansioni. Stato vuoto con Crea primo profilo. Impostazioni marchio con anteprima, validazione del contrasto e reset ai valori predefiniti.

## 7. Stati e microcopy

| Stato | Comportamento previsto |
| --- | --- |
| Caricamento | Contenuto server-rendered; skeleton solo nelle parti aggiornate dinamicamente |
| Bozza modificata | «Modifiche non pubblicate» e avviso prima di abbandonare |
| Salvataggio riuscito | «Bozza salvata» in regione annunciata, senza cambiare lo stato pubblico |
| Pubblicazione riuscita | «Biglietto pubblicato» e collegamento alla pagina pubblica |
| Form non valido | Errori sotto i campi, riepilogo e focus al primo errore |
| Errore rete/server | Mantieni il form; «Operazione non completata. Riprova.» |
| Conflitto fra editor | «Il profilo è stato aggiornato. Confronta le modifiche prima di salvare.» |
| Copia riuscita | «Link copiato»; nessun successo se l'API fallisce |
| Profilo inesistente/sospeso | Pagina neutra, senza identificare la persona o proporre recapiti alternativi |
| Link cancellato | Non appare; non effettuare redirect a una destinazione arbitraria |
| Timeout login | Richiesta di riautenticazione; non perdere silenziosamente modifiche |

## 8. Direzione visiva e componenti

Stile: essenziale, professionale, accento verde petrolio, superfici chiare, righe ben distinte. Gerarchia basata su testo e spazio, senza animazioni continue, statistiche decorative o immagini di persone reali. La motion è limitata a feedback brevi (120–180 ms), compatibili con `prefers-reduced-motion`.

| Token | Valore iniziale |
| --- | --- |
| Sfondo | `#F6F8F7` |
| Superficie | `#FFFFFF` |
| Testo | `#182B27` |
| Secondario | `#52645E` |
| Accento / azione | `#17614D` con testo bianco |
| Bordo | `#D5DFDA` |
| Focus | Anello visibile da 3 px con contrasto verificato |
| Tipografia | System sans: Segoe UI, system-ui, sans-serif; nessun font remoto |
| Spazi | Base 4 px; scale 8, 12, 16, 24, 32, 48 |
| Raggi | 12 px controlli; 20 px pannelli principali |
| Larghezze | Scheda 440 px; gestione fino a 1280 px; mobile da 320 px |
| Target interattivi | Almeno 44 × 44 px come requisito di progetto |

Componenti: BrandMark, ProfileIdentity, ContactActions, LinkList, SharePanel, QrFrame, ProfileForm, PublishBar, ContextSelector, StatusMessage e EmptyState. Nomi progettuali: non sono componenti già realizzati.

L'accento configurabile deve essere validato in tutte le combinazioni: testo normale almeno 4.5:1, testo grande e componenti almeno 3:1 ove applicabile. Se non passa, chiedere un colore diverso o mantenere il colore sicuro sui controlli; non cambiare arbitrariamente il logo caricato.

## 9. Accessibilità e compatibilità

- Obiettivo WCAG 2.2 AA: tastiera, focus, label, gerarchia, contrasto, zoom, reflow e annunci di stato.
- Verifica a 320/390/768/1440 px, zoom 200% e reflow a 400%; niente scroll orizzontale del contenuto.
- Dialog QR: titolo accessibile, focus contenuto e ripristinato, chiusura da tastiera. Il collegamento testuale resta disponibile.
- Foto opzionale; se decorativa rispetto al nome, alternativa vuota. Nessuna immagine necessaria per comprendere i recapiti.
- Scheda e vCard utilizzabili con JavaScript disabilitato; share/copia/anteprima live sono miglioramenti progressivi.
- Matrice di verifica: Safari iOS e Chrome Android per import e share; Edge/Chrome Windows per gestione e download. Le prove fisiche restano necessarie.
- Lingua iniziale italiana; testi estratti in risorse traducibili. Seconda lingua e auto-detection rinviate.

## 10. Decisioni confermate e aperte

Confermate: design neutro, repository futura sotto l'account dell'utente, Apache-2.0 e canali di sostegno già configurati. Il nome Digital Business Card è descrittivo e provvisorio, non un marchio registrato.

Da fissare prima della produzione: dominio pubblico durevole, recapiti realmente pubblicabili, titolare privacy, SMTP, utenti amministratori e destinatari dei backup. Questi dati non impediscono la progettazione e non vanno sostituiti da dati reali nei demo.
