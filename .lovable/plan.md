## Obiettivo

Rendere robuste le mutation sui posti letto in `Camere.tsx` e `Residenti.tsx`: controllare sempre gli errori Supabase e delegare al trigger DB `camere_sync_stato` il ricalcolo dello stato camera dove già interviene, eliminando i ricalcoli client duplicati.

## Contesto verificato

- Il trigger `camere_sync_stato` è già definito sulla tabella `assegnazioni` (vedi `<db-functions>`): dopo insert/update/delete di un'assegnazione ricalcola `camere.stato` (libera / parzialmente_occupata / occupata) e rispetta gli stati `manutenzione` / `non_disponibile` (non li sovrascrive).
- In `Camere.tsx`, le mutation `assegna` e `concludi` NON controllano l'errore Supabase e poi ricalcolano manualmente lo stato camera con dati potenzialmente stantii (`assegnazioni` da cache React Query). `setManutenzione` e `reactivate` non controllano l'errore. Solo `saveCamera` e `deleteCamera` lo fanno già correttamente.
- In `Residenti.tsx`, `transferisci` e `concludi` non controllano errori e chiamano una funzione locale `recalcCameraStato` che duplica la logica del trigger.

## Modifiche

### `src/pages/admin/Camere.tsx`

- **`assegna`**: sostituire con `insert(...)` che controlla `{ error }` e in caso di errore fa `throw error`. Rimuovere completamente il blocco che calcola `nuovoStato` e fa il secondo `update` su `camere` (il trigger se ne occupa). Aggiungere `onError` con toast di errore.
- **`concludi`**: idem. Solo `update` di `assegnazioni` con controllo errore; rimuovere il ricalcolo manuale e il secondo update su `camere`. Aggiungere `onError`.
- **`setManutenzione`**: aggiungere controllo errore sia sul `select` iniziale sia sull'`update` finale; aggiungere `onError`. Il calcolo dello stato resta lato client (il trigger non interviene: nessuna modifica ad `assegnazioni`).
- **`reactivate`**: mantenere il calcolo client di `nuovo` (libera / parz / occupata) perché anche qui non si tocca `assegnazioni`, ma aggiungere controllo errore sull'`update` e `onError`.

### `src/pages/admin/Residenti.tsx`

- **`transferisci`**: aggiungere controllo `{ error }` su ogni chiamata (`update` chiusura vecchia, `select` posti/candidatura, `insert` nuova assegnazione). Rimuovere entrambe le chiamate a `recalcCameraStato`: le mutation su `assegnazioni` triggerano già `camere_sync_stato` per vecchia e nuova camera.
- **`concludi`**: controllare l'errore su `update`; rimuovere la chiamata a `recalcCameraStato`. Aggiungere `onError` (attualmente mancante).
- **Rimuovere la funzione `recalcCameraStato`** (diventa orfana) e la query `tutteAssegnazioniAttive` NON va rimossa perché è usata nel dialog di trasferimento per mostrare l'occupazione delle camere candidate.

## Note tecniche

- Il pattern per il controllo errori è quello già in uso in `saveCamera`/`deleteCamera`: destrutturare `{ error }` dalla risposta Supabase e fare `throw error`. React Query passa l'errore a `onError` che mostra il toast destructive.
- Nessuna migration necessaria: il trigger esiste già e copre tutti i casi di modifica ad `assegnazioni`.
- Il test di concorrenza (due tab che assegnano l'ultimo posto) funzionerà perché il trigger `assegnazioni_check_overbooking` rifiuta la seconda insert con `RAISE EXCEPTION`, che ora arriverà correttamente al toast di errore invece di essere ignorato.
