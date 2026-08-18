# Schema contratti, scadenzario, deposito e fatturazione

Intervento puramente additivo: quattro tabelle nuove con vincoli, trigger e policy. Nessun ALTER, nessun DROP, nessuna modifica a tabelle o dati esistenti. Nessuna interfaccia.

## Tabelle nuove

1. **anagrafiche_fatturazione** — intestatario del documento fiscale: di norma lo studente, ma può essere un soggetto terzo (società sportiva, azienda, genitore con partita IVA). Tipo fra `persona_fisica` e `soggetto_giuridico`, con vincolo che impone nome e cognome nel primo caso e denominazione nel secondo. Dati fiscali (codice fiscale, partita IVA), indirizzo completo con nazione predefinita `IT`, codice destinatario vincolato a 7 caratteri alfanumerici maiuscoli, PEC ed email di recapito, collegamento facoltativo allo studente, `fic_entity_id` per il collegamento futuro, note e timestamp.

   Indice **unico parziale** su `studente_id` quando valorizzato: impedisce di creare in silenzio una seconda anagrafica per lo stesso studente a ogni nuovo contratto. Le anagrafiche intestate a terzi hanno `studente_id` nullo e non sono toccate dal vincolo, quindi resta possibile fatturare a una società o a un genitore.

2. **contratti** — studente e struttura obbligatori, assegnazione facoltativa (per caricare contratti già firmati fuori dal sistema), anagrafica di fatturazione obbligatoria. Tipo fra `breve` e `lunga`. Vincoli sulle date: fine successiva all'inizio e durata massima **12 mesi**, scritta nel database e non solo nell'interfaccia. Canone mensile con nota di scostamento dal listino, aliquota IVA predefinita 10.00. Dati garante tutti facoltativi (se a pagare è una società il garante non esiste). Stato fra `bozza`, `attivo`, `scaduto`, `risolto`, `rinnovato`; auto-riferimento al contratto precedente per i rinnovi; percorso del file firmato, note e timestamp.

   **Il ciclo del deposito vive qui**, non in una tabella separata: il rapporto è uno-a-uno rigido e tenere lo stesso importo in due posti garantisce solo che prima o poi divergano. Campi: `deposito_richiesto` (obbligatorio, predefinito vero), importo pattuito, motivo di esenzione, stato fra `atteso`, `incassato`, `da_restituire`, `restituito`, `trattenuto`, data e modalità di incasso, importo restituito, motivo di trattenuta. Un unico vincolo di coerenza: se il deposito è richiesto servono importo maggiore di zero e stato valorizzato, senza motivo di esenzione; se non è richiesto, importo e stato restano nulli ed è obbligatorio il motivo di esenzione — uno stato `atteso` su un contratto senza cauzione sarebbe una bugia.

3. **canoni** — lo scadenzario. Riferimento al contratto con cancellazione a cascata, competenza vincolata al primo giorno del mese, imponibile e aliquota, **totale calcolato dal database** come colonna generata (imponibile più IVA, arrotondato a due decimali), data di scadenza, stato fra `da_fatturare`, `fatturato`, `incassato`, `annullato`, note e timestamp. Unicità sulla coppia contratto + competenza.

4. **listini** — serve solo a **proporre** il canone in fase di creazione del contratto; il prezzo che vale è quello scritto sul contratto. Struttura, tipo camera (`singola`/`doppia`), importo mensile, periodo di validità con fine facoltativa e coerente. Vincolo di esclusione che vieta periodi sovrapposti per la stessa coppia struttura + tipo camera (btree_gist è già in uso per le assegnazioni). **Nessun dato inserito**: le tariffe le carica la direzione dopo conferma.

## Regole di dominio nel database

- **a. Canoni non riscrivibili.** Trigger prima di ogni modifica o cancellazione su `canoni`, che ramifica sull'operazione (in cancellazione la riga nuova non esiste e leggerla solleverebbe un errore):
  - in **cancellazione** si valuta solo lo stato attuale: rifiuto se è `fatturato` o `incassato`;
  - in **modifica**, quando lo stato attuale è `fatturato` o `incassato`, sono ammesse solo variazioni dello stato limitate al passaggio `fatturato` verso `incassato`, del campo note e di `updated_at`, in qualsiasi combinazione. Qualsiasi altra colonna toccata (imponibile, aliquota, competenza, scadenza, contratto) viene rifiutata con un messaggio in italiano nello stile di quelli già presenti nel progetto;
  - con stato `da_fatturare` o `annullato` nessuna restrizione.

  Una mensilità già fatturata corrisponde a un documento fiscale emesso e non si riscrive.

- **b. Contratti non cancellabili fuori dalla bozza.** Trigger prima della cancellazione su `contratti`: rifiuto se lo stato non è `bozza`. La cascata sui canoni è comoda per scartare una bozza, pericolosa su un contratto reale.

- **c.** Trigger `update_updated_at_column` (funzione già esistente) sulle nuove tabelle con `updated_at`: anagrafiche, contratti, canoni.

Le due funzioni trigger nuove sono **SECURITY INVOKER** (il default) con `SET search_path TO 'public'`, come tutte le funzioni trigger già presenti nel progetto. Nessuna REVOKE: la regola 4 del Context.md riguarda le funzioni RPC invocabili dal client, non i trigger, e dare privilegi elevati a un trigger che si limita a sollevare eccezioni sarebbe superficie di rischio gratuita.

## Sicurezza

RLS attiva su tutte e quattro le tabelle. Per ciascuna una sola policy: l'amministratore autenticato può leggere, creare, modificare ed eliminare; nessun accesso pubblico o anonimo. Permessi concessi a `authenticated` e `service_role`, coerenti con le tabelle di dominio esistenti.

## Dopo la migration

- Rigenerazione di `src/integrations/supabase/types.ts`.
- Nuova sottosezione in `docs/Context.md` §4 con le quattro tabelle e le regole a. e b., nello stile delle voci esistenti. Include una riga esplicita: imponibile e aliquota sui canoni sono uno **snapshot deliberato** dei corrispondenti campi del contratto al momento della generazione della mensilità, non una denormalizzazione da correggere — se il canone del contratto cambia, le mensilità già generate restano quelle che erano. Stesso principio dei campi `*_snapshot` su `candidature`.

## Fuori perimetro

Nessun ALTER su tabelle esistenti, nessuna tabella `depositi` separata, nessuna pagina o componente, nessuna edge function, nessuna tabella fatture, nessun riferimento a Fatture in Cloud oltre alla colonna `fic_entity_id`, nessun seed di dati.