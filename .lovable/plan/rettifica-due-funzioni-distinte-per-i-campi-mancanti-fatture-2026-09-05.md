# Rettifica: due funzioni distinte per i campi mancanti Fatture in Cloud

Il piano approvato per la sincronizzazione anagrafica è confermato nella sua interezza.
Unica correzione: i due consumatori hanno soglie leggermente diverse sull'`email_recapito`.
Si tende quindi `campiMancantiPerFic` come due funzioni distinte nello stesso modulo condiviso `supabase/functions/_shared/fic-anagrafica.ts`.

## 1. Modulo condiviso `supabase/functions/_shared/fic-anagrafica.ts`

- Estrarre la logica comune in una funzione interna `baseCampiMancantiPerFic(a)` che restituisce i campi mancanti indipendentemente dal contesto d'uso:
  - nome/denominazione;
  - via;
  - comune;
  - per Italia: CAP, provincia, almeno un identificativo fiscale (codice fiscale o partita IVA);
  - per estero: nazione.

- Creare due esportazioni pubbliche:
  - `campiMancantiPerFicSync(a)` — usata dall'edge function `fic-sync-anagrafica`. Equivale alla base, **senza** richiedere `email_recapito`: l'email non è necessaria per creare il cliente su Fatture in Cloud.
  - `campiMancantiPerFattura(a)` — risponde alla domanda "cosa manca per emettere fattura": stessa base più `email_recapito` (messaggio "email di recapito"), perché al momento della fattura serve un recapito e per gli studenti esteri l'email è l'unico possibile, dato che lo SDI non consegna all'estero. Il nome descrive la domanda, non il chiamante: in D2 la stessa verifica servirà prima dell'emissione e chi la invocherà non sarà il dialogo del contratto.

## 2. Aggiornamento consumatori

- `supabase/functions/fic-sync-anagrafica/index.ts`: sostituire l'import e la chiamata con `campiMancantiPerFicSync`.
- `src/components/admin/contratti/ContrattoDialog.tsx`: sostituire l'import e la chiamata con `campiMancantiPerFattura`.
- Aggiornare il commento esplicativo vicino all'uso in `ContrattoDialog.tsx` per riflettere la nuova distinzione.

## 3. Suite di test `src/test/fic-anagrafica.test.ts` (nuova in questo giro)

`fic-anagrafica.ts` è puro e senza import esterni, quindi testabile in Vitest. Contiene regole prese dalla guida esterna che non si ricostruiscono a memoria: se regrediscono, il sintomo è una fattura scartata dallo SDI settimane dopo. Copertura:

- **Estero — mappatura:**
  - codice fiscale omesso anche se presente in anagrafica;
  - CAP inviato `00000` con CAP reale accodato all'indirizzo;
  - provincia `EE` quando assente;
  - paese Extra-UE: `vat_number = OO99999999999`;
  - paese UE senza P.IVA: `vat_number` vuoto (Fatture in Cloud scrive codice paese ed ESTERO).
- **Italia — soglie di guardia** di `campiMancantiPerFicSync`:
  - manca CAP → segnalato;
  - manca provincia → segnalato;
  - mancano entrambi gli identificativi fiscali → segnalato.
- **Differenza fra le due funzioni:** un caso che verifichi che `campiMancantiPerFicSync` e `campiMancantiPerFattura` differiscano **solo** sull'`email_recapito` (stessa anagrafica, liste identiche salvo la voce email).

Esito della suite riportato nel resoconto finale.

## 4. Documentazione

- In `docs/Context.md`, nella sezione Fatture in Cloud, documentare le due funzioni e la differenza di soglia:
  - sincronizzazione: campi strettamente necessari alla creazione del cliente;
  - verifica fattura: stessi campi più `email_recapito`, necessaria per l'emissione.
- Annotare che `campiMancantiPerFattura` è prevista per essere riusata in D2 (emissione documento) e non è legata al dialogo del contratto.

## 5. Verifica

- Typecheck e build.
- Esecuzione della nuova suite e riporto dell'esito.
- Nessuna modifica al database, alle policy, ai secret o alle chiamate API esterne.
