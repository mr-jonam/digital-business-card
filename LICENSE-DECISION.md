# Decisione di licenza e provenienza

Revisione corrente: 26 ottobre 2026, MVP implementato. La decisione iniziale del 23 ottobre è conservata più sotto come registro storico.

## Revisione del software implementato

- Codice Node/Express/EJS, CSS/JS/Canvas, template, documentazione e artwork QA originali: Apache-2.0, come richiesto dall’utente, per riuso commerciale e concessione brevettuale esplicita. LICENSE ufficiale invariata.
- Componenti npm diretti e transitivi: inventario di 173 componenti nel lockfile, 139 file di licenza/avviso raccolti in THIRD-PARTY-NOTICES.md. MIT, Apache-2.0, ISC, BSD-3-Clause, 0BSD e MIT-0 conservano i propri avvisi. busboy e streamsearch verificati nei rispettivi LICENSE upstream (MIT), anche se il lockfile omette il campo license.
- sharp è Apache-2.0; i pacchetti libvips opzionali includono LGPL-3.0-or-later e avvisi ulteriori. Il pacchetto di deploy distribuisce sorgenti e lockfile, senza node_modules o binari. npm ci installa su Linux i componenti con le relative licenze. In caso di futura redistribuzione dei binari, raccogliere avvisi, sorgenti corrispondenti e obblighi LGPL di sostituzione/relinking per quella piattaforma. La licenza Apache dell’app non sostituisce la LGPL dei binari.
- Node, Ubuntu, MySQL e Apache sono installati separatamente, non redistribuiti. Foto, loghi e dati reali sono esclusi dalla repository neutra e forniti come configurazione privata esterna. Nessun sorgente ReactBits né font esterno importato.
- Audit npm sulle dipendenze di produzione del 26 ottobre 2026: nessuna vulnerabilità nota segnalata. Non è una garanzia per il futuro.
- Nessun nuovo contributore esterno o materiale contrattuale inserito. La titolarità contrattuale dei materiali forniti dall’utente rimane fuori dalla concessione del progetto neutro.
- Manifest iniziale preservato. Nuovo record con hash dei file e licenza, UUID/token separati; firma digitale e busta identità restano non configurate perché mancano chiavi controllate dall’utente. Nessun identificativo privato o segreto nel registro pubblico.
- Revisione dell’aggiornamento QR/flip del 26 ottobre 2026: nessuna nuova dipendenza o sorgente di terzi. Il simbolo centrale viene dal brand privato esterno e non viene incorporato nei sorgenti neutri. Codice e test generici restano Apache-2.0; gli avvisi delle dipendenze già censite restano applicabili.

## Registro iniziale

Data: 23 ottobre 2026. Ambito iniziale: artefatti di progettazione.

## Obiettivo e scelta

L'utente ha scelto esplicitamente Apache-2.0: condivisione pubblica, modifiche, redistribuzione e riuso anche commerciale, con conservazione degli avvisi e concessione brevettuale prevista dalla licenza. Non è richiesta reciprocità sulle modifiche o sull'uso via rete.

| Componente | Presenza attuale | Decisione e obblighi |
| --- | --- | --- |
| Documentazione progettuale originale | Markdown | Apache-2.0; stesso regime del futuro progetto software per facilitarne il riuso |
| Disegni originali | SVG e PNG derivato | Apache-2.0; nessun logo, foto o font di terzi incorporato |
| Codice applicativo | Assente | Apache-2.0 proposto; verificare contributori e dipendenze all'introduzione |
| Dati demo | Semplici etichette e indirizzi di esempio | Nessun dataset personale o importato; nessuna licenza dati separata necessaria in questa fase |
| Framework, generatori QR e altre librerie | Non distribuiti | Inventario SPDX e avvisi da raccogliere nel build effettivo; nessuna compatibilità già attestata |
| Servizi infrastrutturali | Non distribuiti | Apache/PHP/MySQL richiedono revisione delle versioni e delle condizioni di eventuale redistribuzione |

MIT è un'alternativa permissiva più breve; Apache-2.0 è preferita per la concessione espressa sui brevetti. AGPL non risponde alla preferenza espressa. Una licenza CC separata per i documenti non è necessaria per questo pacchetto di documentazione software.

## Attribuzione e pubblicazione

L'account pubblico del manutentore è `mr-jonam`. Non attribuire il lavoro a un datore di lavoro, non importare materiali aziendali e non pubblicare nomi o recapiti personali senza una scelta esplicita. L'attribuzione del pacchetto usa il riferimento pubblico al manutentore e ai contributori; eventuali titolari differenti e vincoli contrattuali devono essere verificati prima della pubblicazione.

`LICENSE` conserva il testo ufficiale non modificato di Apache-2.0, compreso l'appendice modello. `NOTICE` descrive il pacchetto realmente presente. I canali di sostegno sono stati approvati dall'utente e copiati dalla configurazione locale, senza creazione di abbonamenti o servizi.

La creazione della repository pubblica è rinviata. Una repository pubblica consente visualizzazione e fork secondo i termini di GitHub; Apache-2.0 concede inoltre le autorizzazioni descritte nel proprio testo.

## Provenienza

Il manifest pubblico registra UUID, token casuale e hash degli artefatti tracciati. È generato con lo strumento locale di provenienza, senza chiavi private o identità nominative nel progetto.

Firma digitale e busta identità cifrata sono **non configurate**: richiedono una chiave di firma controllata dall'utente, il destinatario pubblico di cifratura e l'identità sorgente conservata fuori dal repository. Non creare chiavi private o dichiarare verifiche di firma/decrittazione in loro assenza. Il manifest non è una prova legale conclusiva e non garantisce rilevamento delle copie.

## Verifiche prima della pubblicazione futura

1. Verificare titolarità, contributori e assenza di materiali vincolati da contratti.
2. Ripetere inventario licenze su codice, pacchetti, font, immagini e dati effettivamente inclusi.
3. Controllare segreti, cronologia, dati personali e riferimenti aziendali.
4. Preparare gli avvisi richiesti dalle dipendenze e aggiornare questa decisione.
5. Conservare il manifest iniziale; aggiungere un record di release senza sovrascriverlo.
6. Configurare firma/busta cifrata con le chiavi fornite dall'utente, oppure dichiararne l'assenza.

Fonti: https://www.apache.org/licenses/LICENSE-2.0 ; https://docs.github.com/en/site-policy/github-terms/github-terms-of-service


## English interface revision (2026-10-26)

The application interface, accessibility labels, operational messages and notification emails now use English. This revision only translates original project text and adds language assertions to the existing tests. No dependencies, third-party assets or private profile data are added to the public repository. The existing Apache-2.0 decision and third-party notices remain applicable. The original provenance records are retained; `.provenance/release-0.1.0-english-interface.json` records the source snapshot. No signing or encryption keys are configured.
