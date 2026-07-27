# Allineamento `docs/Context.md` e `docs/design-system.md`

Documento riscritto per punti, mantenendo tono di riferimento (presente, non changelog) e struttura esistente. Ogni affermazione qui sotto è stata verificata nel codice.

## `docs/Context.md`

### §3 Ciclo di vita
- Rimuovere lo stato `in_valutazione` dalla sequenza. Nuovo flusso: `ricevuta` → (opz. `in_completamento` →) `completata` → `approvata` | `rifiutata`, più `ritirata` (rinuncia del candidato) e `sostituita`.
- Riscrivere "Fase 3": approvazione e rifiuto sono oggi possibili sia da `ricevuta` sia da `completata` (verificato in `getAvailableActions` di `src/lib/candidaturaActions.ts`).
- Descrivere la riapertura: da `approvata` / `rifiutata` riporta a `completata` se esiste un form completo, altrimenti a `ricevuta` (funzione `reopenStato`).
- Aggiornare l'elenco degli stati eliminando `in_valutazione`.
- Rinominare `ritirata` in "Rinuncia del candidato" nella descrizione.

### §4 Modello dati
- Eliminare la sotto-sezione "Tabelle del form configurabile" e ogni riferimento a `form_campi_custom`, `form_documenti_custom`, `candidature.risposte_custom` (tabelle e colonna droppate nella migration `20260727074958`).
- Aggiungere una nuova sotto-sezione "Tabella di sessione candidatura" per `candidatura_sessioni`: registra ogni apertura del form pubblico (`temp_id`, `origine`, `upload_count`, `consumata_il`); è scritta solo da funzioni `SECURITY DEFINER` (`check_candidatura_sessione`, `consume_candidatura_upload_slot`, `consume_candidatura_sessione`) invocate dalle edge function pubbliche; ha RLS attiva e **zero policy** (accesso solo via `service_role`), che è la configurazione più restrittiva possibile.

### §5 Documenti e storage (integra §7 attuale sui documenti)
- I file arrivano prima in `pending/{temp_id}/{tipo}/{filename}` tramite `upload-candidatura-doc`.
- Al momento dell'invio andato a buon fine (`submit-candidatura` e `complete-candidatura`) l'helper `moveDocumentToFinal` (in `supabase/functions/_shared/move-documenti.ts`) sposta ciascun file in `candidature/{candidatura_id}/{tipo}/{filename}`.
- Se lo spostamento fallisce, il file resta nella cartella temporanea e nel record `documenti` viene salvato il path originale, così la candidatura non si perde; l'errore viene loggato lato server.
- L'insieme dei tipi accettati è fisso — `documento_identita`, `certificato_iscrizione`, `documento_garante`, `documento_aggiuntivo` — definito in un unico modulo condiviso `supabase/functions/_shared/documenti-tipi.ts` e applicato sia dalle edge function sia dal vincolo `documenti_tipo_check` sulla tabella `documenti`.

### §? Limiti di caricamento
- Dimensione massima: **5 MB per file**, sia server (`MAX_BYTES` in `upload-candidatura-doc`) sia client (`MAX_UPLOAD_BYTES` in `src/lib/uploads.ts`).
- Formati accettati: **PDF, JPG, PNG**, sia lato client (`ACCEPTED_UPLOAD_MIME`) sia lato server (allowlist MIME).
- Caricamenti massimi per sessione: **4 file**, imposti atomicamente dalla RPC `consume_candidatura_upload_slot` (migration più recente `20260727104357`).
- Rimuovere dal §7 attuale la menzione dei 10 MB e di WEBP.

### §5 Regole di dominio
- Nella tabella dei trigger mantenere `candidature_log_stato`, ma chiarire nel testo: le righe di **transizione** (`stato_precedente` ≠ `stato_nuovo`) sono scritte esclusivamente dal trigger; il codice applicativo non deve inserire righe di transizione. Le funzioni server inseriscono soltanto righe di **evento** (es. `complete-candidatura` scrive `stato_precedente = stato_nuovo` con nota "Form completo inviato dallo studente") per lasciare traccia di azioni che non cambiano stato.

### §8 Multi-struttura (area amministrativa)
- Chiarire che il filtro sede non è per pagina ma **contesto globale** dell'area admin, con sorgente unica in `StrutturaFilterProvider` (`src/hooks/useStrutturaFilter.ts`), letta da tutte le pagine via `useStrutturaFilter()` e presentata nella top bar.
- Eccezione documentata: `/admin/strutture` mostra sempre tutte le sedi (attive e non), indipendentemente dal filtro globale.

### Nuova §"Area amministrativa"
- Layout `AdminLayout` con sidebar + **top bar globale** che ospita titolo della pagina corrente e selettore struttura.
- Le pagine sotto `/admin` non stampano più titolo proprio: partono dalla toolbar filtri.
- Il titolo mostrato in top bar è risolto da `usePageTitle` (override per rotte con parametri) o dalla mappa statica rotta→label.
- La finestra di dettaglio candidatura è sostituita dalla **pagina persona** `/admin/studenti/:id` (in `src/pages/admin/StudentePage.tsx`): anagrafica in alto, blocchi collassabili per ciascuna candidatura, storico soggiorni. Le liste (Candidature, Residenti) navigano a questa pagina preservando i filtri via URL.

### §3 Form pubblico e §3 Form di completamento
- Il form pubblico non ha più lo step "informazioni aggiuntive": gli step attuali sono anagrafica → dati accademici → preferenze → documenti → dichiarazioni, e l'invio parte dallo step dichiarazioni (verificato: `STEPS` in `Candidatura.tsx`).
- Il form di completamento non ha più il riepilogo finale: step attuali `stile di vita → garante → documenti aggiuntivi → dichiarazioni`, invio dallo step dichiarazioni. Elencare come obbligatori: lingue parlate, orari, personalità (con "altro" testo), ordine/pulizia, fumatore (booleano esplicito), presentazione, garante (nome, relazione, telefono, email), documento d'identità del garante; la documentazione aggiuntiva resta facoltativa.

### §9 Protezione dei dati
- La spunta privacy del form ora rimanda all'informativa pubblicata (`PRIVACY_POLICY_URL = https://studentatoeuropa.it/privacy-policy`) ed è formulata come **presa visione** ("Dichiaro di aver preso visione dell'informativa privacy") e non come autorizzazione — coerente con la base giuridica dichiarata nell'informativa.
- Mantenere invariati tutti i rilievi sull'informativa pubblicata (segnaposto non compilati, §2.2 sottodimensionato, mancata copertura dei candidati non contrattualizzati, garante non menzionato, mancanza di sub-responsabili e localizzazione dati): non risultano risolti.

### §11 Decisioni prese
Aggiungere righe (stesso stile motivo → beneficio):
- Rimozione del form configurabile — semplifica il modello dati e chiude una superficie non usata.
- Rimozione dello stato intermedio `in_valutazione` — il flusso reale ha un solo passaggio decisionale.
- Documenti spostati fuori da `pending/` a fine invio — separa il temporaneo dal definitivo e riduce residui.
- Insieme fisso dei tipi documento in un unico modulo — impedisce divergenze fra client, edge function e DB.
- Filtro sede come contesto globale — impedisce filtri locali incoerenti fra pagine.
- Pagina persona al posto della modale di dettaglio — dà spazio ai dati e permette navigazione con URL.
- Azioni candidatura definite in un unico punto (`src/lib/candidaturaActions.ts`) — lista e scheda non possono divergere.

### §12 Regole per chi ci mette mano
Aggiungere, in stile imperativo, queste voci:
- Non scrivere righe di transizione in `log_stato_candidature` dal codice applicativo: lo fa il trigger; le funzioni server inseriscono al massimo righe di evento con nota.
- I tipi documento si prendono da `supabase/functions/_shared/documenti-tipi.ts`, non si riscrivono altrove.
- Il filtro sede si legge da `useStrutturaFilter`, mai reimplementato localmente.
- Lo stato di una lista (ricerca, filtri, pagina) vive nell'indirizzo (query params), non in navigation state.
- Le azioni disponibili su una candidatura si leggono da `getAvailableActions` in `candidaturaActions.ts`.

### Nuova sezione "Rilievi di sicurezza archiviati"
Rilievi esaminati e chiusi come non applicabili, con condizione di riapertura:
- **Formule negli export**: gli export sono XLSX, dove il tipo cella è dichiarato nel file e il testo non viene reinterpretato. Tornerebbe rilevante se venisse introdotto un export in CSV.
- **`candidatura_sessioni` senza policy**: la tabella ha RLS attiva e zero policy, ossia la configurazione più restrittiva; l'accesso avviene solo tramite `service_role`, che non è soggetto alle policy. Una policy scritta larga la aprirebbe invece di chiuderla.
- **Restrizione delle origini (CORS) sulle edge function**: non applicata deliberatamente; il CORS è imposto dal browser e non protegge da chiamate non-browser, mentre gli endpoint amministrativi richiedono comunque un token. Tornerebbe rilevante se un endpoint iniziasse ad autenticarsi tramite cookie o restituisse dati sensibili senza autenticazione.

## `docs/design-system.md`

### §3 Tipografia (tabella)
- Rimuovere le righe "H1 pagina" e "Sottotitolo / descrizione" (non esistono più titoli interni alle pagine admin).
- Aggiungere una riga "Titolo pagina (top bar)" — reso da `AdminTopBar` con `text-sm font-semibold` (verificare in `AdminTopBar.tsx`) — e chiarire che le pagine non stampano un proprio H1 né sottotitolo; iniziano dalla toolbar filtri o dal contenuto.

## Chiusura del lavoro
Al termine, elencare nel messaggio finale:
1. i punti dove il codice è risultato diverso da quanto indicato nella richiesta (es. numeri o percorsi da rileggere);
2. le parti dei documenti lasciate invariate perché già corrette (es. §5 trigger già presente, §8 struttura filtro già menzionata parzialmente in `design-system.md`).

## Nota tecnica
Solo modifiche a `docs/Context.md` e `docs/design-system.md`. Nessuna modifica al codice, alle migration o alle edge function.
