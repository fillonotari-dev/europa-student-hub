# Scadenza posticipata: la mensilità scade il mese dopo la competenza

Regola unica: il canone di un mese scade il giorno indicato dal contratto **del mese successivo**. Con `giorno_scadenza = 15`, agosto scade il 15 settembre. Nessuna migration: `canoni.scadenza` non ha vincoli che la leghino alla competenza e in produzione non ci sono righe in `canoni`. Nessuna modifica a `attiva_contratto`, `canoni_protect_fatturati`, `aggiorna_canone_contratto`.

## 1. Il calcolo (`src/lib/scadenzario.ts`)

Nel ciclo che indicizza i mesi con `i`, la scadenza si calcola con la stessa aritmetica applicata a `i + 1` (`y = Math.floor((i+1)/12)`, `m = ((i+1) % 12) + 1`), così dicembre 2026 scade a gennaio 2027 senza casi speciali. Il clamp `Math.min(28, ...)` resta: febbraio è un problema anche del mese successivo. Aggiornati il commento in linea (oggi dice che il giorno appartiene al mese di competenza) e il commento in testa al file, che descrive la regola vecchia.

## 2. Test (`src/test/scadenzario.test.ts`)

- Il caso «usa giorno_scadenza per la data di scadenza di ogni mese» viene rinominato (il nome attuale diventa fuorviante) e si aspetta `['2026-10-10','2026-11-10','2026-12-10']`.
- Nuovo: passaggio d'anno — competenza dicembre 2026, scadenza gennaio 2027.
- Nuovo: `giornoScadenza = 28` su competenza gennaio → 28 febbraio.
- Nuovo: contratto di un solo mese — l'unica riga scade nel mese successivo a `data_fine`.

Esito della suite riportato nel resoconto.

## 3. Le due etichette del campo (entrambe dichiarate)

- `src/components/admin/contratti/ContrattoDialog.tsx:538` — etichetta «Giorno di scadenza delle mensilità (1-28)».
- `src/pages/admin/ContrattoPage.tsx:486` — riga «Giorno di scadenza» con modifica in riga e nota sulla bozza.

In entrambi il testo dice che la mensilità scade quel giorno **del mese successivo** a quello di competenza, con un esempio costruito sul valore effettivamente inserito (con 15: «il canone di agosto scade il 15 settembre»). Limiti 1-28 e CHECK del database invariati.

## 4. Didascalia dove competenza e scadenza convivono

Una riga di spiegazione, con il giorno effettivo del contratto, sia nell'anteprima prima di «Attiva contratto» sia sopra la tabella dello scadenzario in `ContrattoPage.tsx`: senza, undici righe con la data del mese dopo si leggono come un errore. Solo token semantici (`text-muted-foreground`), nessun colore scritto a mano — regola 9 di `docs/Context.md`.

## 5. Mese predefinito in Fatturazione

`src/pages/admin/Fatturazione.tsx` usa oggi `meseCorrente()` come valore di ripiego del parametro `mese`. Con la fatturazione posticipata il lotto che si emette il 1° settembre è quello di agosto: il default diventa il **mese precedente** a quello corrente. La definizione di arretrato (competenza precedente al mese scelto, stato `da_fatturare`) resta intatta.

## 6. Documentazione (`docs/Context.md`)

La regola enunciata in un punto solo, con ancoraggio a `src/lib/scadenzario.ts` e `src/test/scadenzario.test.ts`. Righe corrette:

- riga 117 — tabella `contratti`: `giorno_scadenza` non è «il giorno del mese in cui scade ogni mensilità» ma il giorno del **mese successivo** alla competenza.
- riga 129 — voce su `generaScadenzario` (canone intero sui mesi parziali): aggiunta la regola della scadenza posticipata, con il rimando ai test.
- riga 308 — nota sul giorno di scadenza modificabile in bozza: allineata al nuovo significato.
- riga 359 — `payments_list[0].due_date`: aggiunto che il ripiego «scadenza anteriore all'emissione» da ora scatta **solo sugli arretrati**, perché con la scadenza posticipata una mensilità corrente non nasce mai già scaduta.

Ogni riga toccata elencata nel resoconto.

## Fuori perimetro (dichiarato)

Nessuna migration, nessuno UPDATE sui dati esistenti, nessuna modifica alle funzioni di database citate, nessun cambio ai limiti 1-28.

## Verifica finale

Suite Vitest, typecheck, build; confronto punto per punto col piano e segnalazione di eventuali scostamenti.
