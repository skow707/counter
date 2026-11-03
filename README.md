# ABARC Orario Counter

Un contatore leggermente ironico per la storia delle versioni dell'orario ABARC, pubblicato come GitHub Page. È volutamente semplice: `index.html` legge `data/versions.json` e mostra il registro.

## Idea

Ogni 15 minuti GitHub Actions controlla [https://www.abarc.it/totem/](https://www.abarc.it/totem/) e la pagina ufficiale dell'orario. Il controllo risolve il contenuto reale del totem, scarica il PDF pubblicato nella bacheca e calcola due impronte SHA-256: il counter aumenta quando cambia una delle due fonti.

- se il contenuto reale è uguale all'ultimo salvato, non succede niente anche se cambia l'header della pagina contenitore;
- se il contenuto reale cambia, viene registrata una nuova versione;
- se la richiesta fallisce, il contatore non aumenta;
- la prima risposta valida dell'anno accademico 2026/27 diventa la versione #1.

Se il server non invia `Last-Modified`, il controllo usa `ETag`; se manca anche quello, usa SHA-256 del contenuto come fallback. Il valore originale viene sempre conservato in `data/versions.json`.

## Avvio locale

Per vedere l'anteprima locale, dalla cartella del progetto avvia un server statico:

```bash
python3 -m http.server 8000
```

Poi apri [http://localhost:8000](http://localhost:8000). Serve HTTP perché la pagina legge `data/versions.json` con `fetch`.

Per eseguire un controllo reale:

```bash
node scripts/check-schedule.mjs
```

La prima riga di `data/versions.json` è la prima risposta `HEAD` reale osservata il 30 settembre 2026; non sono state inserite versioni precedenti inventate.

## Pubblicazione su GitHub Pages

1. Crea il repository GitHub e collegalo a questa cartella.
2. Pubblica il branch `main`.
3. In **Settings → Pages**, scegli **GitHub Actions** come sorgente.
4. Avvia manualmente il workflow **Controlla Last-Modified ABARC** una prima volta.

Il workflow `deploy-pages.yml` pubblica direttamente i file HTML/CSS/JS. Il workflow `check-schedule.yml` controlla il totem e il PDF ufficiale ogni 15 minuti, aggiorna `data/versions.json` e pubblica una nuova versione solo quando una delle fonti cambia.

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

## Struttura

- `index.html`: interfaccia della pagina;
- `styles.css`: stile responsive;
- `app.js`: lettura del JSON e rendering di contatore, cronologia e dettagli;
- `data/versions.json`: storico persistente;
- `scripts/check-schedule.mjs`: controllo `HEAD` e aggiornamento dello storico.
