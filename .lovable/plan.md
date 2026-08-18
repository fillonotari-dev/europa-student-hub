# Contratti: correzioni post-rilascio

## 1. Eliminazione contratto in bozza

Azione "Elimina contratto" disponibile solo quando `stato = 'bozza'`:

- nella scheda `/admin/contratti/:id`, con dialogo di conferma distruttivo, e ritorno a `/admin/contratti` al termine;
- nel menu di riga della lista (`RowActions`), con la stessa condizione.

Ordine obbligatorio, identico a quello di `delete-candidatura`: se `file_firmato_path` è valorizzato si cancella prima il file dal bucket `contratti`; se quella cancellazione fallisce ci si ferma con un messaggio d'errore e il database non viene toccato. Solo a storage pulito si cancella la riga di `contratti`.

Le mensilità spariscono da sole (cascata) e i campi del deposito stanno sulla stessa riga. La riga di `anagrafiche_fatturazione` non viene cancellata: è riusabile e legata alla persona.

Logica condivisa fra scheda e lista in un unico helper, così le due strade non possono divergere.

## 2. Contratti nella scheda persona

Nuova sezione "Contratti" in `StudentePage.tsx`, nello stile delle sezioni esistenti: elenco ordinato per `data_inizio` decrescente con periodo, canone, stato, PDF firmato sì/no e link a `/admin/contratti/:id`. Senza contratti, stato vuoto esplicito con il pulsante di creazione.

Il pulsante "Crea contratto" resta per gli stadi `assegnato` e `in_casa`. Se per quella persona esiste già un contratto `attivo`, il pulsante diventa secondario e accanto compare un avviso con il link al contratto attivo. Nessun blocco: il rinnovo è legittimo.

## 3. Limiti del bucket

Verificato: oggi `file_size_limit` e `allowed_mime_types` di `contratti` sono entrambi nulli. Migration che imposta 10 MB e solo `application/pdf`, con lettura di controllo della riga dopo l'esecuzione.

## 4. Attivazione e modifica canone atomiche

Due funzioni Postgres, entrambe SECURITY INVOKER (le policy del chiamante continuano ad applicarsi) e `SET search_path TO 'public'`:

- `attiva_contratto(p_contratto_id uuid, p_righe jsonb) RETURNS integer` — eccezione se il contratto non esiste o non è in `bozza`, inserimento delle righe e passaggio ad `attivo` nella stessa transazione, ritorna il numero di mensilità create.
- `aggiorna_canone_contratto(p_contratto_id uuid, p_canone numeric) RETURNS integer` — eccezione se il contratto non esiste, aggiorna `canone_mensile` e porta a `p_canone` l'imponibile dei soli canoni `da_fatturare` con competenza dal mese corrente in poi, ritorna quante mensilità ha toccato.

`ContrattoPage.tsx` chiama entrambe via `rpc()` al posto delle due scritture separate. La generazione delle righe resta in `src/lib/scadenzario.ts`: nessuna duplicazione in SQL.

## 5. Validazione della modifica in riga

`salvaRiga()` valida prima di scrivere: imponibile numerico e maggiore o uguale a zero, scadenza non vuota e data valida. Messaggi in italiano, nessun errore grezzo di Postgres mostrato all'operatore.

## 6. Giorno di scadenza modificabile in bozza

Finché lo stato è `bozza`, `giorno_scadenza` è correggibile in linea nella scheda contratto con lo stesso schema già usato per il canone, vincolo 1–28. Da `attivo` in poi torna in sola lettura.

## 7. Documentazione

`docs/Context.md`: eliminazione consentita solo in bozza con la regola "prima lo storage, poi il database", le due nuove funzioni e il motivo per cui esistono (atomicità), la sezione Contratti nella scheda persona.

## Fuori perimetro

Nessuna modifica ai trigger `canoni_protect_fatturati` e `contratti_protect_delete`. Nessuna modifica allo schema oltre alla configurazione del bucket e alle due funzioni. Nessun ciclo del deposito, nessun editor listini, nessun promemoria in Home, nessun riferimento a servizi di fatturazione esterni.
