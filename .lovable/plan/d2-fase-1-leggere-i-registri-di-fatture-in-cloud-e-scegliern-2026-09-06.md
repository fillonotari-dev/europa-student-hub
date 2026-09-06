# D2 — Fase 1: leggere i registri di Fatture in Cloud e sceglierne i valori

Questo giro **non emette nulla**. Prepara i due identificativi che l'emissione
richiederà e li rende scegliibili dall'operatore. La funzione `fic-emetti-fattura`
non viene scritta in questo intervento.

## Perché questa fase esiste

La guida ufficiale di creazione documento di Fatture in Cloud impone due cose
che il piano precedente sbagliava:

- l'IVA di riga è `vat: { id: <id dell'aliquota nel registro dell'azienda> }`,
  non `vat: { value: 10 }`;
- il metodo di pagamento è `payment_method: { id: <id> }` al **primo livello**
  del documento, non un nome dentro `payments_list`; l'`id` è l'unico parametro
  richiesto e un id inesistente produce errore.

Quegli id appartengono all'account e vanno letti prima di poterli usare.

## 1. Edge function `fic-registri` (sola lettura)

- Nuovo blocco in `supabase/config.toml` con `verify_jwt = true`, più controllo
  `has_role(auth.uid(), 'admin')` in codice, come `fic-sync-anagrafica`.
- Legge `GET /c/{company_id}/info/payment_methods` e
  `GET /c/{company_id}/info/vat_types` e restituisce due elenchi:
  `{ metodi: [{ id, name }], aliquote: [{ id, value, description }] }`.
- Nessuna scrittura remota, nessuna scrittura su tabelle di dominio.
- Scrive in `fic_log` con `operazione = 'leggi_registri'`, con la stessa
  diagnostica 400/422 già in uso in `fic-sync-anagrafica` (`estraiDiagnosticaFic`)
  e gli stessi retry limitati sugli errori di quota. Il token non compare mai.

### `_shared/fic-client.ts`

`ficFetch` (chiamata con retry di quota, lettura delle quote residue),
`isQuotaError`, `estraiDiagnosticaFic`. Lo usa **soltanto la funzione nuova**.

`fic-sync-anagrafica` resta esattamente com'è: è l'unico percorso verso Fatture
in Cloud già validato sul campo, e riscriverlo dentro l'intervento che introduce
l'emissione renderebbe impossibile attribuire un'eventuale rottura. Il modulo
nuovo porta in testa un commento che dichiara l'unificazione rinviata e il motivo.

## 2. Migration additiva su `public.impostazioni`

Solo `ADD COLUMN`, nullable, nessun default, nessuna modifica alle colonne
esistenti né ai dati:

- `fic_metodo_pagamento_id integer NULL`
- `fic_vat_id integer NULL`
- `fic_vat_valore numeric NULL`

`fic_metodo_pagamento` (testo) resta dov'è e non viene toccata: continua a
descrivere il metodo in modo leggibile.

## 3. Interfaccia — sezione Fatture in Cloud di `/admin/impostazioni`

In `src/components/admin/impostazioni/FattureInCloudSection.tsx`, dentro
"Impostazioni di fatturazione":

- un pulsante **Carica dall'account** che invoca `fic-registri`;
- due elenchi a scelta (`Select`) popolati dal risultato: **metodo di pagamento**
  e **aliquota IVA**, ciascuno con etichetta leggibile (nome del metodo;
  descrizione e valore percentuale dell'aliquota);
- il salvataggio scrive `fic_metodo_pagamento_id`, `fic_vat_id`,
  `fic_vat_valore` e, per il metodo, anche il nome in `fic_metodo_pagamento`;
- finché gli elenchi non sono stati caricati, i valori già salvati vengono
  mostrati come testo ("metodo id 3 — non ancora verificato sull'account"), senza
  perderli;
- nessun pulsante di emissione, nessun documento creato.

## 4. Guardie che l'emissione dovrà rispettare (dichiarate ora, applicate dopo)

Vengono scritte in `docs/Context.md` in questo giro, perché la modalità prova da
sola non protegge: `dry_run` non chiama Fatture in Cloud, quindi un payload con
i campi sbagliati passerebbe il collaudo e fallirebbe alla prima emissione reale.

- l'emissione si ferma se `fic_metodo_pagamento_id` o `fic_vat_id` sono nulli;
- l'emissione si ferma se `canoni.aliquota_iva` è diversa da `fic_vat_valore`:
  sono due numeri che devono coincidere e oggi nulla lo garantisce;
- il payload restituito in modalità prova mostrerà gli id **insieme al nome
  leggibile**, così che l'operatore riconosca ciò che sta guardando invece di
  leggere due numeri.

## 5. Punto di fermata

Si conclude qui, con il resoconto. L'emissione (`fic-emetti-fattura`, scrittura
in due fasi, dialogo nello scadenzario) è il messaggio successivo, dopo aver
verificato che gli elenchi mostrino i valori veri dell'account di Navona.

## 6. Domanda aperta da risolvere nel resoconto

Verificare sulla documentazione — senza implementare nulla — se per far comparire
l'IBAN sulla fattura serva anche indicare un **payment account** collegato al
pagamento, invece che il campo IBAN libero già presente nelle impostazioni.
L'esito viene dichiarato nel resoconto.

## Verifica

- Typecheck, build e suite esistente invariati (nessuna logica pura toccata).
- Prova reale: caricare gli elenchi dall'account e leggere i valori restituiti.
