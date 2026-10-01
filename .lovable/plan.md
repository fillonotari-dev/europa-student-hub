# Fatturazione: tabella del mese completa, stato vuoto fuori dalla tabella

Situazione attuale verificata in `src/pages/admin/Fatturazione.tsx`: la query `['fatturazione-canoni', mese]` (righe 124-154) legge solo `da_fatturare` di contratti attivi; le fatturate si leggono a parte (`['fatturazione-mese-fatturate']`, righe 284-297) solo quando il mese è vuoto e finiscono in `StatoVuoto` dentro una cella; il prossimo lotto (righe 298-313) guarda solo il mese immediatamente successivo.

## 1. Tabella con tutte le mensilità del mese
- Nuova query `['fatturazione-mese-fatturate', mese]` sempre attiva (non più legata a `meseVuoto`): canoni `fatturato` e `incassato` del mese, di qualunque contratto, con studente, struttura, importi, scadenza e la fattura collegata (`fatture!canoni_fattura_id_fkey(numero, numerazione, url_documento)`). Annullate escluse.
- La query delle da fatturare resta invariata.
- Righe unite: prima le da fatturare, poi le fatturate, ciascun gruppo ordinato per cognome (come oggi, `localeCompare 'it'`).
- Riga fatturata: stesse colonne, cella checkbox vuota, Stato = `StatoBadge` con `STATO_CANONE` seguito da "7/S" (link a `url_documento` in nuova scheda se valorizzato), nessun menu ⋯. Componente `RigaFatturata` definito fuori da `Fatturazione`.

## 2. Anteprima e selezione solo sulle da fatturare
- `ids` dell'anteprima, `emettibili`, "Seleziona tutte", `selezionate` e totale continuano a derivare solo dalla lista delle da fatturare: le fatturate non entrano mai nella chiamata a fic-emetti-fattura.

## 3. Stato vuoto fuori dalla tabella
- Elimino `StatoVuoto`.
- Da fatturare = 0 e fatturate > 0: sopra la tabella, una riga "Agosto 2026 completato: 6 mensilità fatturate." e la tabella sotto con le sole righe fatturate.
- Nessuna mensilità: niente tabella, solo "Nessuna mensilità in questo mese".

## 4. Prossimo lotto
- Query `['fatturazione-prossimo-lotto', mese]`: canoni `da_fatturare` di contratti attivi con competenza >= primo del mese successivo, `order competenza`, `limit 1`; poi conteggio esatto di quel mese.
- Compare accanto a "completato" o a "Nessuna mensilità", col pulsante Vai già esistente.
- Invalidazioni dopo la creazione invariate (le chiavi esistono già, riga 215).

## 5. Verifica
- Typecheck, test, build.
- Playwright sola lettura (nessun clic su Conferma e crea, Collega, Salva), screenshot allegati:
  - `/admin/fatturazione` senza parametri apre settembre 2026;
  - `?mese=2026-08`: 6 righe fatturate con 1/S...6/S, riga "completato", prossimo lotto ottobre 2026;
  - `?mese=2026-10`: 6 righe da fatturare selezionabili.
- Aggiorno docs/Context.md (voce "Due tab"/stato vuoto) e roadmap.md.

## Note
- Nessuna migration, nessun dato modificato, nessuna edge function toccata.
- Se settembre senza parametri non si apre (dipende da `mesePredefinito` e dalla mensilità più vecchia), lo segnalo senza cambiare la regola.
