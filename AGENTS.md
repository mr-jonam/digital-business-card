# Digital Business Card — mappa minima

- Stato: repository di progettazione; nessuna applicazione o dipendenza installata.
- Specifica prodotto: `docs/PRODUCT-UX.md`.
- Contratto tecnico: `docs/TECHNICAL-BLUEPRINT.md`.
- Deployment previsto: `docs/AZURE-WINDOWS.md`.
- Ordine e test: `docs/IMPLEMENTATION-PLAN.md`.
- Design originale: `docs/design/overview.svg`; PNG derivato per anteprima.
- Stack proposto: PHP/Laravel server-rendered, MySQL 8.4 LTS, Apache 2.4 Windows.
- Entrypoint futuri: `public/index.php`, `artisan`; non ancora presenti.
- Test futuri: `php artisan test`, smoke test HTTP e browser; non ancora eseguibili.
- Config futura: `.env` privato; distribuire solo un `.env.example` senza segreti.
- CI: assente per scelta; nessun workflow da attivare senza necessità/autorizzazione.
- Comandi attuali: `git status --short`, `git diff --check`.
- Nessun dato personale reale, nome aziendale, logo di terzi o URL di profili reali nei demo.
- Una organizzazione per installazione; ruoli e ownership dei profili devono essere verificati sul server.
- Schema, comandi e rotte nei documenti sono contratti progettuali, non funzionalità esistenti.
- Licenza: Apache-2.0 per gli artefatti originali; terze parti da verificare prima di introdurle.
- Fondi: usare solo i canali già approvati in `.github/FUNDING.yml`.
- Pubblicazione GitHub, deploy e release sono rinviati alla fase successiva.
