# Schema contratti, scadenzario, depositi e fatturazione

Intervento puramente additivo: cinque tabelle nuove con vincoli, trigger e policy. Nessun ALTER, nessun DROP, nessuna modifica a tabelle o dati esistenti. Nessuna interfaccia.

## Tabelle nuove

1. **anagrafiche_fatturazione** — intestatario del documento fiscale (lo studente oppure un soggetto terzo: società sportiva, azienda, genitore con partita IVA). Tipo fra `persona_fisica` e `soggetto_giuridico`, con vincolo che impone nome e cognome nel primo caso e denominazione nel secondo. Dati fiscali (codice fiscale, partita IVA), indirizzo completo con nazione predefinita `IT`, codice destinatario vincolato a 7 caratteri alfanumerici maiuscoli, PEC ed email di recapito, collegamento facoltativo allo studente, `fic_entity_id` per il collegamento futuro, note e timestamp.

2. **contratti** — studente e struttura obbligatori, assegnazione facoltativa (per caricare contratti già firmati fuori dal sistema), anagrafica di fatturazione obbligatoria. Tipo fra `breve` e `lunga`. Vincoli sulle date: fine successiva all'inizio e durata massima **12 mesi**, scritta nel database e non solo nell'interfaccia. Canone mensile con nota di scostamento dal listino, aliquota IVA predefinita 10.00. Blocco deposito coerente: se richiesto serve un importo maggiore di zero, altrimenti serve il motivo di esenzione. Dati garante tutti facoltativi (con una società a pagare il garante non esiste). Stato fra `bozza`, `attivo`, `scaduto`, `risolto`, `rinnovato`; auto-riferimento al contratto precedente per i rinnovi; percorso del file firmato, note e timestamp.

3. **canoni** — lo scadenzario. Riferimento al contratto con cancellazione a cascata, competenza vincolata al primo giorno del mese, imponibile e aliquota, **totale calcolato dal database** come colonna generata (imponibile più IVA, arrotondato a due decimali), data di scadenza, stato fra `da_fatturare`, `fatturato`, `incassato`, `annullato`, note e timestamp. Unicità sulla coppia contratto + competenza.

4. **depositi** — una riga per contratto (vincolo di unicità), importo maggiore di zero, data e modalità di incasso, stato fra `atteso`, `incassato`, `da_restituire`, `restituito`, `trattenuto`, importo restituito e motivo di trattenuta, timestamp.

5. **listini** — serve solo a **proporre** il canone in fase di creazione del contratto; il prezzo che vale è quello scritto sul contratto. Struttura, tipo camera (`singola`/`doppia`), importo mensile, periodo di validità con fine facoltativa e coerente. Vincolo di esclusione che vieta periodi sovrapposti per la stessa coppia struttura + tipo camera (btree_gist è già in uso per le assegnazioni). **Nessun dato inserito**: le tariffe le carica la direzione dopo conferma.

## Regole di dominio nel database

- **a. Canoni non riscrivibili.** Trigger prima di ogni modifica o cancellazione su `canoni`: la riga il cui stato attuale è `fatturato` o `incassato` non si tocca, con le sole eccezioni del passaggio da `fatturato` a `incassato` e dell'aggiornamento del campo note. Una mensilità fatturata corrisponde a un documento fiscale emesso.
- **b. Contratti non cancellabili fuori dalla bozza.** Trigger prima della cancellazione su `contratti`: rifiuto se lo stato non è `bozza`. La cascata su canoni e depositi è comoda per scartare una bozza, pericolosa su un contratto reale.
- **c.** Trigger `update_updated_at_column` (funzione già esistente) su tutte le nuove tabelle con `updated_at`: anagrafiche, contratti, canoni, depositi.

Le due funzioni trigger nuove sono SECURITY DEFINER con `search_path` fissato e revoca esplicita dell'esecuzione a PUBLIC, anon e authenticated (regola 4 del Context.md).

## Sicurezza

RLS attiva su tutte e cinque le tabelle. Per ciascuna una sola policy: l'amministratore autenticato può leggere, creare, modificare ed eliminare; nessun accesso pubblico o anonimo. Permessi concessi a `authenticated` e `service_role`, coerenti con le tabelle di dominio esistenti.

## Dopo la migration

- Rigenerazione di `src/integrations/supabase/types.ts`.
- Nuova sottosezione in `docs/Context.md` §4 con le cinque tabelle e le regole a. e b., nello stile delle voci esistenti.

## Fuori perimetro

Nessun ALTER su tabelle esistenti, nessuna pagina o componente, nessuna edge function, nessuna tabella fatture, nessun riferimento a Fatture in Cloud oltre alla colonna `fic_entity_id`, nessun seed di dati.