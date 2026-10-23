# Decisione di licenza e provenienza

Data: 23 ottobre 2026. Stato: revisione iniziale degli artefatti di progettazione.

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
