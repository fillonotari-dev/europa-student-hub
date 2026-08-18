# Contratti: pagina, scadenzario e PDF firmato

## Nota preliminare verificata sul codice

Le regole 6 e 13 del Context citano `useStrutturaFilter`, ma **quell'hook non esiste più nel codice**: il filtro sede globale è stato rimosso e le liste admin (Residenti, Candidature) leggono la sede da un query param `sede` con un `Select` popolato da `strutture`. La pagina Contratti seguirà il pattern realmente in uso (query param `sede`), coerente con la regola 14, e il Context verrà corretto su questo punto.

## 1. Storage

Bucket privato nuovo `contratti`, separato da `documenti_studenti` perché quest'ultimo viene ripulito da `delete-candidatura` e un contratto firmato non deve poter finire in quella cancellazione.

- Path: `{contratto_id}/{nome_file}`
- Policy su `storage.objects` per `bucket_id = 'contratti'`: SELECT / INSERT / UPDATE / DELETE solo `TO authenticated` con `has_role(auth.uid(), 'admin')`. Nessun accesso anonimo.
- Vincolo sul bucket: `file_size_limit` 10 MB e `allowed_mime_types` limitato a `application/pdf`, così il limite vive nel database e non solo nell'interfaccia. Validazione anche lato client.
- Lettura via signed URL a scadenza breve, come per `documenti_studenti`.

## 2. Migration (tabella vuota, unica migration)

```sql
ALTER TABLE public.contratti
  ADD COLUMN giorno_scadenza smallint NOT NULL DEFAULT 1
    CHECK (giorno_scadenza BETWEEN 1 AND 28);
ALTER TABLE public.contratti DROP COLUMN tipo;
```

Più la creazione del bucket e delle sue policy. Nessun altro ALTER. Rigenerazione di `src/integrations/supabase/types.ts` dopo l'applicazione.

## 3. Pagina lista `/admin/contratti`

Voce di sidebar "Contratti" fra Residenti e Camere. Nessun titolo stampato: lo mostra la top bar.

Colonne: studente (link alla scheda persona), struttura, periodo, canone mensile, stato, deposito (importo oppure "non richiesto"), PDF firmato sì/no. Filtro stato, filtro sede, ricerca per nome, paginazione — tutto nei query params. Pulsante "Nuovo contratto".

## 4. Creazione del contratto

Due ingressi: "Crea contratto" nella scheda persona per gli stadi `assegnato` e `in_casa`, e "Nuovo contratto" dalla lista.

Precompilazioni (tutte correggibili): studente, assegnazione attiva o futura se esiste, struttura dalla camera dell'assegnazione, date dall'assegnazione, canone dal listino valido oggi per (struttura, tipo camera) — se manca, campo vuoto con testo di aiuto e nessun blocco — aliquota 10.00, dati garante dalla candidatura più recente, tutti facoltativi. Nessun campo "tipo di contratto".

Anagrafica di fatturazione, due strade:

- **Intesta allo studente**: se esiste già un'anagrafica con quello `studente_id` la riusa (indice unique parziale) mostrando i campi in aggiornamento; altrimenti la crea precompilata da `studenti`.
- **Intesta a un altro soggetto**: modulo completo con `studente_id` nullo.

Codice destinatario proposto e modificabile: `0000000` se nazione `IT`, `XXXXXXX` altrimenti.

**Pattuizione del deposito** (obbligatoria nel modulo: `deposito_richiesto` ha default `true` e il vincolo `contratti_deposito_coerenza_chk` respingerebbe l'insert senza importo e stato):

- `deposito_richiesto`: interruttore, predefinito attivo
- se attivo: `deposito_importo` obbligatorio e maggiore di zero, `deposito_stato` impostato dal sistema a `atteso` senza chiederlo all'operatore, `deposito_motivo_esenzione` resta nullo
- se disattivato: `deposito_motivo_esenzione` obbligatorio (testo libero), importo e stato restano nulli

Il deposito non richiesto è un caso reale: per le locazioni garantite da una società sportiva non si chiede né deposito né garante, e serve traccia scritta del motivo. Restano fuori perimetro i campi del ciclo di vita del deposito (data incasso, modalità, importo restituito, motivo trattenuta) e ogni transizione di `deposito_stato` oltre ad `atteso`.

Codice fiscale, partita IVA, codice destinatario ed email di recapito **non** sono obbligatori: al loro posto un avviso non bloccante che elenca i dati fiscali mancanti e avverte che serviranno alla fattura. Serve per casi reali già in produzione (studente senza codice fiscale italiano).

Il contratto nasce in stato `bozza`.

## 5. Attivazione e scadenzario

Azione "Attiva contratto": da `bozza` ad `attivo`, e solo in quel momento genera i `canoni`. La bozza resta modificabile e cancellabile.

Funzione pura in `src/lib/scadenzario.ts`:

- una riga per ogni mese di calendario toccato dal periodo, estremi inclusi
- `competenza` = primo giorno del mese
- `imponibile` = canone mensile **intero** anche sui mesi parziali (rateo non ancora deciso con la direzione, non va inventato)
- `aliquota_iva` dal contratto, `scadenza` = `giorno_scadenza` del mese di competenza, stato `da_fatturare`
- **mai** il campo `totale`: è `GENERATED ALWAYS STORED` e Postgres rifiuta l'intera scrittura se le si assegna un valore, anche se i tipi generati la espongono come scrivibile

Prima della scrittura, anteprima delle mensilità (mese, importo, scadenza, totale complessivo) e conferma esplicita.

## 6. Modifica del canone su contratto attivo

Nessuna riscrittura silenziosa. Riepilogo di quali mensilità verranno ricalcolate — solo `da_fatturare` con competenza corrente o futura — elenco esplicito di quelle intoccabili perché `fatturato` o `incassato`, poi conferma. L'interfaccia non tenta la scrittura sulle righe protette: il rifiuto del trigger è la rete di sicurezza, non la logica.

## 7. Scheda contratto `/admin/contratti/:id`

Dati del contratto, anagrafica di fatturazione, garante, deposito in sola lettura, e tabella mensilità (competenza, imponibile, IVA, totale, scadenza, stato) con modifica in riga di imponibile, scadenza e note per le sole righe `da_fatturare`.

## 8. PDF firmato

Upload nella scheda contratto (solo PDF, max 10 MB), path salvato in `file_firmato_path`, sostituzione possibile, apertura via signed URL. Nella lista solo la presenza o assenza.

## 9. Test

`src/test/scadenzario.test.ts`: 12 righe su 01/09/2026 → 31/08/2027 con competenze da 01/09/2026 a 01/08/2027; 4 righe su 15/09/2026 → 20/12/2026 tutte a canone intero; 1 riga per un periodo dentro un solo mese; `giorno_scadenza = 10` produce scadenze al 10; nessun campo `totale` in output.

## 10. Documentazione

`docs/Context.md`: nuova pagina in §8bis, bucket `contratti` e motivo della separazione nella sezione documenti e storage, regola provvisoria del canone intero sui mesi parziali marcata come da confermare con la direzione, sottosezione `contratti` senza `tipo` e con `giorno_scadenza`. Correzione delle regole 6 e 13 sul filtro sede.

## Fuori perimetro

Nessun altro ALTER. Nessuna gestione depositi oltre la lettura, nessun editor listini, nessun promemoria in Home, nessuna generazione del contratto da modello, nessun riferimento a Fatture in Cloud, nessuna modifica a candidature, assegnazioni, camere, studenti o alle edge function esistenti.
