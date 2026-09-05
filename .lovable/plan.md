# Riga di destinazione: usare anaCorrente mentre l'id dello studente carica

Una sola correzione, nel modulo puro, più un test. Nessuna modifica al database, nessuna policy.

## Il difetto

`rigaDestinazioneAnagrafica` (`src/lib/anagraficaFatturazione.ts`) in modalità "studente" guarda solo `anagraficaStudenteId`, che in `IntestazioneFatturaDialog` arriva da una query asincrona. Nei primi istanti dopo l'apertura quel valore è `null`: se l'operatore salva in quella finestra su un contratto già intestato allo studente, la funzione risponde `crea`, l'INSERT viola l'indice unico parziale `anagrafiche_fatt_studente_uniq` (migration `20260818221948_...`) e l'operatore vede un errore Postgres grezzo su un'azione legittima.

## La correzione

In modalità "studente", se `anagraficaStudenteId` non è ancora disponibile ma `anaCorrente.studente_id` è valorizzato (il contratto è già intestato allo studente, quindi l'anagrafica è la sua per l'unicità dell'indice), la destinazione è `anaCorrente.id`:

```text
modalità studente:
  anagraficaStudenteId presente        → aggiorna quella riga
  altrimenti anaCorrente.studente_id   → aggiorna anaCorrente.id
  altrimenti                           → crea riga nuova
```

Il caso `anaCorrente` di un terzo con id non ancora caricato resta `crea`: corretto, perché lo studente potrebbe non avere ancora alcuna anagrafica — è il caso in cui il salvataggio legittimo è proprio un INSERT. La finestra residua (contratto intestato a un terzo, anagrafica dello studente esistente ma id non ancora caricato, salvataggio immediato) non è eliminabile dalla funzione pura senza attendere il caricamento; è dichiarata qui come limite noto e resta coperta dal messaggio d'errore già mostrato dal dialogo.

## Test

Quinto caso in `src/test/anagrafica-fatturazione.test.ts`: modalità studente, `anagraficaStudenteId: null`, `anaCorrente` dello studente → `{ azione: 'aggiorna', id: anaCorrente.id }`. I quattro test esistenti restano invariati e devono continuare a passare.

## Verifiche

Typecheck, build, suite completa (attesi 47 test). Riporto l'esito.
