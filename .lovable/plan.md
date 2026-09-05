# Schema fatture e impostazioni di emissione

Obiettivo: registrare le fatture e le impostazioni che ne governano l'emissione. Nessuna chiamata a Fatture in Cloud in questo giro. Intervento additivo: nessun DROP, nessun ALTER restrittivo, nessuna modifica ai dati esistenti.

## 1. Tabella `public.fatture` (migration)

Colonne: `id` uuid, `contratto_id` uuid NOT NULL con FK su `contratti`, `fic_document_id` bigint NULL, `numero` integer NULL, `numerazione` text NULL, `data` date NULL, `imponibile` numeric(10,2), `iva` numeric(10,2), `totale` numeric(10,2), `ei_status` text NULL, `url_documento` text NULL, `stato` text NOT NULL con CHECK in (`in_invio`, `emessa`, `errore`), `messaggio_errore` text, `created_at`, `updated_at` con trigger `update_updated_at_column` (funzione esistente).

- Ordine obbligatorio: CREATE TABLE → GRANT SELECT, INSERT, UPDATE, DELETE ad `authenticated` e GRANT ALL a `service_role` → ENABLE ROW LEVEL SECURITY → unica policy FOR ALL admin via `has_role(auth.uid(), 'admin')`, in linea con la migration `20260818221948`.
- Indice unico parziale: `CREATE UNIQUE INDEX ... ON fatture (fic_document_id) WHERE fic_document_id IS NOT NULL` — vieta due righe locali per lo stesso documento remoto.

## 2. Colonna `canoni.fattura_id` + trigger

- `ALTER TABLE public.canoni ADD COLUMN fattura_id uuid NULL REFERENCES public.fatture(id)` — resta nullable; nessun vincolo ulteriore.
- `CREATE OR REPLACE FUNCTION public.canoni_protect_fatturati()`: aggiunta di `fattura_id` all'elenco delle colonne immutabili quando lo stato è `fatturato`/`incassato` (elenco attuale verificato nel codice: `contratto_id`, `competenza`, `imponibile`, `aliquota_iva`, `scadenza`, `id`, `created_at`). Restrizione aggiuntiva, non allentamento. Il collegamento resta possibile mentre lo stato è `da_fatturare`. La funzione resta SECURITY INVOKER con `SET search_path TO 'public'`, corpo altrimenti identico, messaggi in italiano invariati.

## 3. Cinque colonne su `public.impostazioni` (migration)

Solo ADD COLUMN nullable, tabella a riga singola verificata (colonne attuali: `id`, `contatto_email`, `contatto_telefono`, `contatto_whatsapp`, `contatto_orari`, `notifica_email`, `updated_at`):

- `fic_numerazione` text DEFAULT '/S'
- `fic_giorni_scadenza` integer DEFAULT 30
- `fic_giorno_emissione` integer DEFAULT 25
- `fic_iban` text
- `fic_metodo_pagamento` text DEFAULT 'bonifico'

La riga esistente (id=1) eredita i default senza UPDATE manuale. RLS e policy esistenti invariate.

## 4. Interfaccia: sezione Impostazioni di fatturazione

In `src/components/admin/impostazioni/FattureInCloudSection.tsx`, sotto lo stato della connessione: cinque campi (numerazione, giorni scadenza, giorno emissione, IBAN, metodo pagamento) con salvataggio sulla riga `impostazioni` id=1.

- Il campo numerazione mostra l'avviso «non modificabile dopo la prima fattura emessa» e diventa di sola lettura se esiste almeno una riga in `fatture` con `stato = 'emessa'` (conteggio via query admin).
- Validazione lato client: giorni come interi positivi, IBAN come testo libero max 34 caratteri.

## Fuori perimetro

Nessuna emissione, nessuna edge function nuova, nessun pulsante "Emetti", nessuna chiamata a Fatture in Cloud oltre alla verifica connessione già esistente.

## Dettagli tecnici

- Dopo la migration: rigenerazione tipi (`types.ts` auto-gen), poi modifica UI.
- Ancoraggi: trigger `canoni_protect_fatturati` (migration `20260818221948`), `update_updated_at_column` esistente, tabella `impostazioni` riga singola id=1, componente `FattureInCloudSection.tsx` creato in B1.
- `docs/Context.md`: nuova sottosezione con tabella `fatture`, colonna `canoni.fattura_id`, indice unico parziale e le cinque impostazioni di emissione.
- Verifica finale: typecheck + build.
