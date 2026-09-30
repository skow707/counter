# ABARC Orario Counter

Un contatore leggermente ironico per la storia delle versioni dell'orario ABARC, pubblicato come GitHub Page.

## Idea

Ogni 30 minuti GitHub Actions fa una richiesta `HEAD` a [https://www.abarc.it/totem/](https://www.abarc.it/totem/) e legge l'header `Last-Modified`.

- se il valore è uguale all'ultimo salvato, non succede niente;
- se cambia, viene registrata una nuova versione;
- se la richiesta fallisce, il contatore non aumenta;
- la prima risposta valida dell'anno accademico 2026/27 diventa la versione #1.

Se il server non invia `Last-Modified`, il controllo usa `ETag`; se manca anche quello, usa SHA-256 del contenuto come fallback. Il valore originale viene sempre conservato in `data/versions.json`.

## Avvio locale

Richiede Node.js 20+.

```bash
npm install
npm run dev
```

Per eseguire un controllo reale:

```bash
npm run check
```

Non viene inserita nessuna versione iniziale inventata: `data/versions.json` è volutamente vuoto.

## Pubblicazione su GitHub Pages

1. Crea il repository GitHub e collegalo a questa cartella.
2. Pubblica il branch `main`.
3. In **Settings → Pages**, scegli **GitHub Actions** come sorgente.
4. Avvia manualmente il workflow **Controlla Last-Modified ABARC** una prima volta.

Il workflow `deploy-pages.yml` costruisce il sito statico e lo pubblica. Il workflow `check-schedule.yml` controlla il totem ogni 30 minuti, aggiorna lo storico e fa partire una nuova pubblicazione solo quando il file cambia.

Se il repository GitHub non esiste ancora, dopo averlo creato vuoto puoi collegare questa cartella così:

```bash
git init -b main
git add .
git commit -m "feat: crea ABARC orario counter"
git remote add origin https://github.com/TUO-USERNAME/NOME-REPO.git
git push -u origin main
```

## Fonti

- Fonte primaria: [ABARC Totem](https://www.abarc.it/totem/)
- Fonte secondaria: [Bacheca / Orari](https://www.abarc.it/bacheca/orari/)

## Verifica locale

```bash
npm test
npm run lint
npm run build
```
