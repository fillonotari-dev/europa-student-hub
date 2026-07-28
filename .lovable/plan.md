Piano rivisto con le cinque correzioni. Le verifiche pre-piano sono state fatte: **nessun CHECK su `versione_form`** (i CHECK presenti coprono solo `stato`, `lingua`, `tipo_camera_preferito`) e **`documenti.url` contiene il path relativo al bucket** già oggi (formato `candidature/{id}/{tipo}/{filename}`), quindi utilizzabile direttamente in `storage.remove`.

## §1 — Assegnazione contestuale

Nuovo dialogo `AssegnaCameraDialog` in `src/hooks/useCandidaturaActions.tsx`. `assegna_camera` NON naviga più a `/admin/camere?candidatura=…`.

**UI**: filtri Struttura (default = `struttura_preferita_id`, toggle "Tutte") e Periodo (default = periodo candidatura, editabile). Elenco via `rpc('camere_disponibilita', {p_dal, p_al, p_struttura_id})`, filtrato a `posti_liberi > 0`. Per le doppie con un posto occupato nel periodo, query batch su `assegnazioni` (camera_id ∈ elenco, stato='attiva', studente_id ≠ corrente) joinata a `candidature` per estrarre lifestyle del futuro compagno; overlap in JS.

Selezione: radio camera, data inizio/fine obbligatorie, nota opzionale.

**Sequenza di conferma con rollback esplicito** (correzione 1):
1. Calcolo `posto` libero (primo intero 1..N assente da `posti_occupati_numeri`).
2. `insert` in `assegnazioni` (stato='attiva'), select id.
3. `update candidature set stato='accolta' where id=…`.
4. Se (3) fallisce → `delete from assegnazioni where id=<id passo 2>`. Toast di errore esplicito "Impossibile completare l'assegnazione. Nessuna modifica salvata." La mutazione ritorna errore, la UI resta aperta. Nessuna email inviata.
5. Se (3) riesce → `functions.invoke('send-esito-email', { candidatura_id, nota })`. Fallimento email → toast di avviso "assegnazione registrata, email non inviata — usa Invia esito", `esito_email_inviata_il` NULL. NON rollback.

## §2 — Rinnova soggiorno

Voce `rinnova_soggiorno` in `src/lib/candidaturaActions.ts` per stadio `in_casa`, gruppo `secondaria`, icona `RefreshCw`. Richiede `assegnazione_id`.

Dialogo condiviso con §1:
- se `data_fine_corrente` è NULL → messaggio bloccante e chiusura.
- default nuova `data_inizio` = `data_fine + 1 giorno`, `data_fine` vuota obbligatoria.
- filtro struttura default = struttura corrente, toggle "Tutte".
- lista via `camere_disponibilita(new_dal, new_al, struttura?)`; la camera corrente può ricomparire perché con `+1 giorno` gli intervalli non si toccano e GIST accetta.

Conferma: singolo `insert` in `assegnazioni` (nuovo periodo, stessa `candidatura_id`/`studente_id`, stato='attiva'). Nessun cambio a `candidature.stato`. **Nessuna email**.

## §3 — Nuovo soggiorno da archiviato

**Verificato**: `versione_form` non ha CHECK, `'interna'` è accettabile.

Voce `nuovo_soggiorno` per stadio `archiviato`, gruppo `principale`, icona `PlusCircle`.

Dialogo: Struttura (default = ultima usata), Periodo, poi selezione camera (componente §1), nota opzionale.

**Sequenza (correzione 3: nessuna email)**:
1. Leggi ultima `candidatura` dello studente per copiare `universita_snapshot`, `corso_snapshot`, `anno_corso_snapshot`, `matricola_snapshot`, `tipo_studente`, `tipo_studente_altro`.
2. Calcola `anno_accademico` da `data_inizio`.
3. `insert candidature`: `stato='accolta'`, `versione_form='interna'`, snapshot copiati, `dichiarazioni={}`.
4. `insert assegnazioni` sulla nuova candidatura.
5. Se (4) fallisce → `delete from candidature where id=<id passo 3>` per non lasciare orfani, toast errore esplicito, nessuna modifica finale. (Simmetrico a §1.)
6. **Nessun `send-esito-email`.** Chi rientra per accordo verbale non ha atteso un esito. Se l'operatore vuole avvisare, usa l'azione "Contatta".

## §4 — Eliminazione via edge function

Nuova edge `supabase/functions/delete-candidatura/index.ts` (verify_jwt default; `getClaims` + `has_role(user_id,'admin')`; service-role per scritture).

**Verificato**: `documenti.url` è già un path bucket-relative (`candidature/{cid}/{tipo}/{file}`), quindi valido per `storage.from('documenti_studenti').remove([...paths])`.

**Ordine**:
1. Leggi candidatura → `studente_id`.
2. `count(assegnazioni where candidatura_id=…)` (qualsiasi stato). Se >0 → `409 { error:'assegnazione_collegata' }`.
3. `select url from documenti where candidatura_id=…` → estrai path (assunto già bucket-relative; se una riga contenesse per errore un URL completo con `http://` o `/storage/v1/object/…`, log warning e skip — non delete della riga DB — per evitare silent-drop).
4. `storage.from('documenti_studenti').remove(paths)` → cattura `data` (elenco effettivamente rimosso) e `error`. Confronta con l'input: eventuali path non rimossi vanno loggati esplicitamente.
5. **Verifica bucket post-delete (correzione 4)**: per ciascun path richiesto, `storage.from('documenti_studenti').list(prefix, { search: filename })` per confermare assenza. Se un file risulta ancora presente → abort, `500 { error:'storage_cleanup_failed', paths }`, NIENTE delete righe DB (i documenti sensibili restano tracciati nel database così si vedono in scheda persona).
6. `delete documenti where candidatura_id=…`.
7. `delete log_stato_candidature where candidatura_id=…`.
8. `delete candidature where id=…`.
9. Studente: se `count(candidature)=0 && count(assegnazioni)=0` → `delete studenti where id=…`.

Ritorno: `{ ok:true, studente_eliminato:boolean }`. Client (`deleteCandidatura` in `useCandidaturaActions.tsx`) diventa `functions.invoke`; toast e navigazione differenziati; su `storage_cleanup_failed` mostrare messaggio esplicito che invita a contattare il supporto — la candidatura resta.

## §5 — Una sola candidatura per email

**Verifica lato dev**: `studenti.email` è UNIQUE, il fallback `23505` funziona.

**Server** (`submit-candidatura/index.ts`) — correzione 5, codice neutro:
- Dopo `.maybeSingle()` su `existingStudent`, se presente rispondi **`200 { ok:false, code:'invio_rifiutato' }`**. Log server: `console.warn('submit: refused, existing student', { email_hash })` (hash o solo la parte iniziale — mai email in chiaro nei log applicativi lato client).
- Insert studente 23505 → stessa risposta `invio_rifiutato`.
- Insert candidatura 23505 → stessa risposta `invio_rifiutato`.
- Qualsiasi validazione fallita che oggi ritorna un motivo specifico resta invariata: `invio_rifiutato` copre SOLO i casi di duplicazione. Il codice è indistinguibile per il client tra "email esiste", "insert race duplicate", "candidatura duplicata" — un solo oracolo neutro.

**Client** (`src/pages/Candidatura.tsx`): quando `code === 'invio_rifiutato'`, schermata generica "Non è stato possibile completare l'invio. Se hai già una candidatura in corso, contattaci." + bottone `mailto:info@studentatoeuropa.it` (chiedo conferma indirizzo esatto se preferisci uno diverso). Nessun dettaglio.

**Attivazione**: solo dopo che (a) edit anagrafica in scheda persona è online (già presente) e (b) `nuovo_soggiorno` (§3) è disponibile — così l'admin ha strade per creare/modificare uno studente esistente. Documentato in `docs/Context.md`.

## §6 — Tre correzioni note

**(a) Trasferisci** (`useCandidaturaActions.tsx`): sostituire `camereDest` + `assegnazioniAttiveRaw` con `useQuery` su `rpc('camere_disponibilita', {p_dal:transferData, p_al:transferFine, p_struttura_id:null})`, chiave query = `[..., transferData, transferFine]`. Filtro `posti_liberi > 0`.

**(b) Camere.tsx**: `occCount(cameraId)` e il blocco riduzione posti (~linea 185) leggono da `rpc('camere_disponibilita', {p_dal:today, p_al:today, p_struttura_id:null})` → mappa camera_id → `posti_occupati_numeri.length`. Il vincolo `camere_check_posti` DB già valida server-side.

**(c) `annullaAssegnazione`**: firma `({ candidatura, assegnazione_id })`, `.eq('id', assegnazione_id).delete()`. Gate "solo pre-arrivo" resta (SELECT `data_inizio` prima). Chi la chiama passa `c.assegnazione_id` (già su `candRifDecorata`).

## §Fix email di esito nel gesto

1. **Rifiuta**: `trigger('rifiuta', c)` apre dialogo con Textarea "Nota per lo studente (opzionale)". Conferma: `requestStatoChange('rifiutata')` (gate assegnazione attiva esistente) + `invoke('send-esito-email', …)`. Fallimento email → avviso esplicito, stato resta rifiutata, `esito_email_inviata_il` NULL.
2. **Assegna** (§1): email nel gesto, con la sequenza rollback definita sopra.
3. **Nuovo soggiorno** (§3): NIENTE email di esito.
4. **Dashboard.tsx**: rimuovere query `esitiDaComunicare` e relativo `taskItem`.
5. **Azione `invia_esito` — etichetta condizionale (correzione minore)**:
   - Compare quando `stato ∈ {accolta, rifiutata}` (regola allargata, così copre anche i casi in cui l'invio nel gesto è fallito).
   - Label dinamica: `esito_email_inviata_il == null ? 'Invia esito' : 'Reinvia esito'`. Da implementare in `ACTION_META` o direttamente nel componente che renderizza (`RowActions` / `CandidaturaActions`) leggendo il flag dalla candidatura decorata.

## File toccati

- `src/lib/candidaturaActions.ts` — nuove voci; label `invia_esito` diventa dinamica.
- `src/hooks/useCandidaturaActions.tsx` — nuovi dialoghi (assegna con rollback, rinnova, nuovo, rifiuta con nota); refactor `annullaAssegnazione`, `deleteCandidatura` (invoke), query camere trasferimento.
- `src/pages/admin/Camere.tsx` — `occCount` via RPC; rimuovere banner `?candidatura=` (dead-code) e mutazione `assegna` inline.
- `src/pages/admin/Dashboard.tsx` — rimozione item esiti.
- `src/pages/Candidatura.tsx` — gestione `invio_rifiutato` con schermata generica + mailto.
- `supabase/functions/submit-candidatura/index.ts` — codice neutro `invio_rifiutato`, log server-side.
- `supabase/functions/delete-candidatura/index.ts` (nuovo) — con verifica bucket post-delete.
- `docs/Context.md` — nota su nuovi gesti, email nel gesto, blocco email univoca, flusso eliminazione.

## Verifiche di uscita

- §1: forzare fallimento passo 3 (es. mock error) → assegnazione cancellata, nessun residuo.
- §3: creare nuovo soggiorno da archiviato → controllare tabella `email_send_log`: nessuna riga generata per questo evento.
- §4: eliminare candidatura reale con documenti → confermare via `storage list` che i file sono spariti; provare percorso con path artefatto malformato → verifica fallisce, righe DB preservate.
- §5: submit con email esistente → response `{ok:false, code:'invio_rifiutato'}`, nessuna riga creata; ripetere con email nuova + due submit paralleli per innescare 23505 → stesso codice.
- §6a/b: cambiare periodo trasferimento → lista camere si aggiorna.
- Email condizionale: candidatura appena passata a `accolta` con invio fallito → menu mostra "Invia esito"; dopo invio riuscito → "Reinvia esito".
