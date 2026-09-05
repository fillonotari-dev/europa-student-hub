# Inserimento manuale di una persona (solo database)

Obiettivo: l'amministrazione può registrare una persona mai passata dal form pubblico, creando in un'unica transazione lo studente, la candidatura già accolta e — se serve — l'assegnazione al posto letto. Nessuna interfaccia in questo giro.

## Verifiche già fatte sul database

- La colonna `origine` su `candidature` **non esiste** oggi (query di controllo fallita con "column origine does not exist"): è una colonna nuova.
- `SELECT DISTINCT versione_form FROM public.candidature` restituisce esattamente due valori: `pre_screening` e `completa`. Non ne aggiungiamo altri.
- Su `assegnazioni` esistono già il vincolo `assegnazioni_no_overlap` (EXCLUDE GIST su camera+posto+periodo per le attive) e il trigger `assegnazioni_check_overbooking`: la nuova funzione si appoggia a loro invece di duplicare i controlli.
- Su `studenti` esiste `studenti_email_key` (email unica): è il vincolo che produce l'errore 23505 da tradurre.

## Cosa faremo

### 1. Migration additiva
- Nuova colonna `candidature.origine` testuale, obbligatoria, con valore predefinito `form_pubblico` (tutte le righe esistenti la ereditano).
- Nuovo vincolo `candidature_origine_chk`: sono ammessi solo `form_pubblico` e `inserimento_manuale`.
- Nessun altro ALTER, nessun DROP, nessuna modifica ai dati esistenti.
- Subito dopo eseguiamo il conteggio per origine e riportiamo il risultato: atteso tutto `form_pubblico`.

### 2. Nuova funzione `public.crea_persona_manuale(p_studente jsonb, p_candidatura jsonb, p_assegnazione jsonb DEFAULT NULL)`
- `SECURITY INVOKER`, `SET search_path TO 'public'`, restituisce `{"studente_id":…, "candidatura_id":…, "assegnazione_id":…}`.
- Legge dai jsonb solo i campi attesi e ignora ogni altra chiave. In particolare `stato`, `origine`, `studente_id` e `candidatura_id` non arrivano mai dal client: li impone la funzione (`origine = 'inserimento_manuale'`, `stato = 'accolta'`, `assegnazioni.stato = 'attiva'`).
- Campi letti da `p_studente`: nome, cognome, email, telefono, data di nascita, cittadinanza, codice fiscale e flag "CF non disponibile", indirizzo completo (via, civico, CAP, comune, provincia, nazione), università, corso, anno di corso, matricola, email per fattura.
- Campi letti da `p_candidatura`: struttura preferita, tipo camera preferito, periodo inizio/fine, anno accademico, versione form (solo `pre_screening` o `completa`, default `completa`), lingua, note admin, messaggio, priorità.
- Campi letti da `p_assegnazione`: camera, posto, data inizio, data fine, note.
- L'assegnazione viene creata solo se `p_assegnazione` non è nullo, collegata allo studente e alla candidatura appena creati.

### 3. Errori tradotti in italiano
- Email già presente (`23505` su studenti) → `esiste_gia_persona: esiste già una persona registrata con questa email`.
- Posto letto già occupato (violazione del vincolo EXCLUDE) → messaggio in italiano nello stile del progetto, es. `posto_occupato: il posto è già assegnato a un'altra persona nel periodo indicato`.
- Gli errori sollevati dal trigger di overbooking (posto fuori range, camera non disponibile) risalgono invariati.
- Nessun controllo preventivo di disponibilità: la verità resta nei vincoli.

### 4. Permessi
Come per `attiva_contratto` (migration `20260818234428`): `REVOKE ALL ... FROM PUBLIC`, `REVOKE EXECUTE ... FROM anon`, `GRANT EXECUTE ... TO authenticated`. Le policy esistenti (`Admins full access ...`, solo `authenticated`) restano l'unico filtro di accesso ai dati, coerente con `SECURITY INVOKER`.

### 5. Riga nello storico
Inseriamo in `log_stato_candidature` una riga di **evento** (non di transizione): `stato_precedente` nullo, `stato_nuovo = 'accolta'`, nota "Persona inserita manualmente dall'amministrazione". È lo stesso schema usato da `submit-candidatura` alla creazione. Segnalo uno scostamento formale: la regola 11 di `docs/Context.md` descrive le righe evento come `stato_precedente = stato_nuovo`, mentre qui — come in `submit-candidatura` — la creazione usa `stato_precedente` nullo. Nessuna riga di transizione viene scritta a mano: il trigger `candidature_log_stato` reagisce solo agli UPDATE, quindi non c'è duplicazione.

### 6. Chiusura
- Rigenerazione di `src/integrations/supabase/types.ts`.
- Voce in `docs/Context.md` che descrive la colonna `origine` e la funzione `crea_persona_manuale`, con l'ancoraggio al nome della migration.

## Fuori perimetro (dichiarato)
Nessuna interfaccia amministrativa, nessuna edge function, nessuna email: la funzione resta al momento richiamabile solo dal database.
