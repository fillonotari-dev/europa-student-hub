
## Verifica preliminare

`fetchStadi` (src/lib/studentiQuery.ts) unisce `versione_form / esito_email_inviata_il / token_scade_il / completata_il / anno_accademico / created_at` alla riga di vista tramite un secondo select su `candidature`. I badge e il gate `versione_form !== 'completa'` funzionano. Nessun undefined silenzioso.

## Correzioni

### 1. `invia_esito` universale su stato candidatura

In `getAvailableActions`, valutato fuori dallo switch:

```
if ((c.stato === 'accolta' || c.stato === 'rifiutata')
    && !c.esito_email_inviata_il) push('invia_esito')
```

Rimuovere `invia_esito` dal case `assegnato`. `CandidaturaLike.stato` esiste già; `toCandidaturaLike` lo popola con `candidatura_stato`.

### 2. `in_casa`: `trasferisci` e `concludi_soggiorno`

Le due mutazioni si estraggono da `Residenti.tsx` in `useCandidaturaActions.tsx`. Nuovi `CandidaturaActionId`: `trasferisci`, `concludi_soggiorno`.

`CandidaturaLike` guadagna campi opzionali:
- `assegnazione_id`, `camera_id_corrente`, `data_fine_corrente`
Valorizzati in `toCandidaturaLike` delle liste (già in `StadioRow`) e in `StudentePage.tsx` dalla assegnazione `attiva` corrente.

Dialoghi trasferimento + conclusione spostati nell'hook, con lo stesso comportamento attuale: chiusura vecchia a `nuovo_inizio - 1` + insert nuova (motivo `trasferimento`); RPC `camere_disponibilita` per calcolare posto libero.

**Query camere di destinazione**: la query `tutteCamere` va portata dentro l'hook, altrimenti la tendina esce vuota. Nell'occasione filtro corretto: `.eq('stato','disponibile')` (oggi è `.neq('stato','manutenzione')` e include per errore `non_disponibile`).

`Residenti.tsx` rimuove stati/mutazioni/dialoghi locali; le voci del `RowActions` chiamano `trigger('trasferisci', c)` / `trigger('concludi_soggiorno', c)`. La scheda persona ottiene le azioni "gratis" via `getAvailableActions`.

Gate: `trasferisci` e `concludi_soggiorno` compaiono solo se `c.assegnazione_id` presente.

### 3. `assegnato`: solo `annulla_assegnazione` (+ `contatta`, + `invia_esito` da §1)

**Trasferisci NON si offre su `assegnato`.** Il flusso attuale chiude la vecchia riga a `nuovo_inizio - 1`; se l'assegnazione non è ancora cominciata, quella data cade prima della sua `data_inizio` e daterange con estremi invertiti fa esplodere il vincolo GIST con errore Postgres grezzo.

Per rimpiazzare un'assegnazione pre-arrivo esiste già `annulla_assegnazione`, che cancella la riga e riporta a `da_decidere` (da cui si riassegna in modo pulito).

`case 'assegnato'`:
- `annulla_assegnazione`
- (`invia_esito` arriva da §1 se pertinente, `contatta` in fondo)

Nessun ramo "aggiorna la stessa riga" per l'assegnazione mai iniziata: se serve, sarà un intervento separato.

### 4. `da_valutare`: una sola azione principale

Regola: principale = `invia_form_completo`. Retrocedere `assegna_camera` e `metti_in_attesa_posto` a `secondaria` **solo in questo case**, via override in `getAvailableActions` (copia dell'oggetto action con `group: 'secondaria'` prima del push). `ACTION_META` resta invariato.

**Sotto-caso**: se `c.versione_form === 'completa'`, `invia_form_completo` non si pusha (già oggi). In quel solo caso `assegna_camera` resta **principale** — evitiamo di lasciare la riga senza pulsante primario.

`rifiuta` resta secondaria.

### 5. `elimina`: escludere chi ha MAI avuto un'assegnazione

Serve **sdoppiare l'insieme oggi chiamato `candidatureConAssegnazione`**, che alimenta due cose diverse in `useCandidaturaActions`:

- gate di `elimina` — deve considerare **qualsiasi** assegnazione (anche conclusa)
- avviso "Esiste già un'assegnazione attiva" nel dialogo di conferma cambio stato rischioso (`requestStatoChange`) — deve considerare **solo `attiva`**, altrimenti l'avviso comparirebbe per chi ha finito il soggiorno un anno fa.

Rifattorizzazione:

- `Options` di `useCandidaturaActions` diventa:
  - `studentiHaAvutoAssegnazione?: Set<string>` — set di **candidatura_id** senza filtro `stato`. Usato dal gate di `elimina` (che oggi vive lato hook come `count > 0` server-side; il set client serve a **nascondere** l'azione, non solo a bloccarla).
  - `studentiHaAssegnazioneAttiva?: Set<string>` — set di candidatura_id con `stato='attiva'`. Usato da `hasAssegnazioneAttiva` e da `requestStatoChange`.
- `getAvailableActions` accetta come opzione booleana `haAvutoAssegnazione` (già calcolato dal chiamante via set). Se `true`, `elimina` non viene aggiunto per lo stadio `archiviato / da_valutare / in_attesa_studente`.
- In `Candidature.tsx` e `StudentePage.tsx`: due useQuery separate.
  - `assegnazioni-any` → `select('candidatura_id')` senza filtro.
  - `assegnazioni-attive` → `select('candidatura_id').eq('stato','attiva')`.
- Passare `hasAssegnazioneAttiva` al context (già presente) e `haAvutoAssegnazione` alle `getAvailableActions`. `CandidaturaActions.Menu` legge dal context e passa il flag prima di renderizzare le voci.

Il gate server-side in `deleteCandidatura` (mutation) resta come rete di sicurezza.

Verifica dei punti d'uso attuali di `candidatureConAssegnazione` prima di riassegnarli:
- `useCandidaturaActions.hasAssegnazioneAttiva` (contesto) → **attiva**
- `requestStatoChange` (branch "rischioso") → **attiva**
- `Candidature.tsx` (opzione hook) → passa **entrambi** i set

## File toccati

- `src/lib/candidaturaActions.ts` — nuovi id, override group per `da_valutare`, `invia_esito` globale, flag `haAvutoAssegnazione` in signature, campi opzionali su `CandidaturaLike`.
- `src/hooks/useCandidaturaActions.tsx` — sdoppio opzioni set (attiva/mai), mutazioni + dialog `trasferisci` / `concludi_soggiorno`, query interna camere destinazione con `.eq('stato','disponibile')`.
- `src/pages/admin/Residenti.tsx` — rimozione mutazioni/state/dialog locali; toCandidaturaLike include `assegnazione_id`, `camera_id_corrente`, `data_fine_corrente`; menu chiama `trigger`.
- `src/pages/admin/Candidature.tsx` — due useQuery separate (any / attiva); toCandidaturaLike include `stato` (già ok) e nessun campo assegnazione (non applicabile).
- `src/pages/admin/StudentePage.tsx` — stesso sdoppio set; toCandidaturaLike include assegnazione attiva se presente.
- `src/components/admin/CandidaturaActions.tsx` — legge `haAvutoAssegnazione` per la riga corrente e lo passa a `getAvailableActions`.

## Fuori scopo

Nessuna migration. Nessun cambio a `v_studenti_stadio`, RPC, schema. Nessun ramo "modifica in place" per il trasferimento pre-arrivo.

## Verifica

- `bunx tsgo --noEmit`.
- Manuale:
  - Rifiutato archiviato → mostra "Comunica esito" finché non inviato.
  - `in_casa` sulla scheda persona → Trasferisci + Concludi soggiorno.
  - `assegnato` → Annulla assegnazione (nessun Trasferisci).
  - `da_valutare` non completa → pulsante primario "Invia form completo"; `da_valutare` completa → primario "Assegna camera".
  - Persona con soggiorno concluso l'anno scorso: nessun avviso "assegnazione attiva" al cambio stato; `elimina` non compare.
  - Tendina camere del dialogo Trasferisci non include camere `non_disponibile`.
