## Obiettivo

Completare gli avvisi/validazioni del gruppo **Medio** e **Basso** della precedente analisi, e poi consolidare le regole più critiche a livello di **database** con vincoli e trigger, così che eventuali bug futuri o operazioni dirette su DB non possano più creare incoerenze.

Tutto resta nel perimetro admin: nessuna modifica al form pubblico, nessuna nuova feature funzionale.

---

## Parte 1 — Avvisi UI Medio/Basso

### `src/pages/admin/Candidature.tsx`

- **(M-13) Validazione struttura in modalità "Assegna a camera"**: quando si arriva da `?candidatura=…`, mostrare un banner inline sopra la lista camere se la `struttura_preferita_id` della candidatura è diversa dalla struttura della camera che si sta per scegliere. Non bloccante, solo warning con conferma esplicita all'assegnazione.
- **(B-15) Badge "Link form completo attivo"**: già introdotto parzialmente, estendere la riga della tabella con un badge compatto colorato in base allo stato del token (`attivo · scade gg/mm`, `scaduto`, `compilato`).

### `src/pages/admin/ConfigForm.tsx`

- **(M-9) Warning su elimina campo/documento custom** con dati raccolti:
  - Per i campi: query `count` su `candidature` filtrato con operatore JSONB `risposte_custom ? chiave`.
  - Per i documenti: query `count` su `documenti` con `tipo == chiave`.
  - Se > 0, mostrare `AlertDialog` "Esistono N risposte/documenti già raccolti. L'eliminazione li rende orfani (resteranno visibili come 'campo non più configurato')". Conferma richiesta.
- Stesso warning, più morbido, su **disattivazione** (`attivo = false`) solo se ci sono dati raccolti: "I dati restano visibili nello storico ma il campo non sarà più richiesto nei nuovi form."

### `src/pages/admin/Dashboard.tsx`

- **(B-16) Sezione "Richiede attenzione"**: nuovo gruppo di task sopra quelli esistenti, popolato con:
  - Candidature in stato `ricevuta` da > 7 giorni.
  - Candidature con `token_scade_il < now()` ancora in stato `in_completamento`.
  - Camere in `manutenzione` da > 30 giorni.
  - Assegnazioni con `data_fine` passata ma `stato = 'attiva'`.
  Ogni voce linka alla pagina filtrata corrispondente. Nessuna nuova query: si estende `admin-tasks`.

### Componente comune

- Nessun nuovo componente: si riusa `AlertDialog` esistente (il refactor in `ConfirmDestructive.tsx` proposto la volta scorsa non serve a questi punti — restano dialog locali, già coerenti come pattern).

---

## Parte 2 — Vincoli a livello di database

Per garantire integrità anche al di fuori della UI, aggiungiamo i seguenti vincoli/trigger via migrazione. **Non distruttiva**: tutti i nuovi check sono compatibili con i dati esistenti (verifico prima con una `SELECT` di scoperta).

### A. Camere: posti ≥ occupanti attivi

Trigger `BEFORE UPDATE ON camere`: se `NEW.posti < (count assegnazioni attive su camera_id)`, solleva `RAISE EXCEPTION 'posti_inferiori_a_occupanti'`. La UI già blocca, il trigger è la rete di sicurezza.

### B. Assegnazioni: no overbooking

Trigger `BEFORE INSERT OR UPDATE ON assegnazioni`:

- se `NEW.stato = 'attiva'`, controllare `count(*) filter (where stato='attiva' and id<>NEW.id) < camere.posti`.
- inoltre `NEW.posto` deve essere ≤ `camere.posti` e univoco tra le attive sulla stessa camera (`UNIQUE INDEX` parziale).
- la camera non deve essere in stato `manutenzione` o `non_disponibile`.

```sql
CREATE UNIQUE INDEX assegnazioni_camera_posto_attive_uq
ON public.assegnazioni (camera_id, posto)
WHERE stato = 'attiva';
```

### C. Candidatura: stato vs assegnazione attiva

Trigger `BEFORE UPDATE ON candidature`:

- se `OLD.stato = 'approvata'` e `NEW.stato IN ('rifiutata','ritirata','in_valutazione','ricevuta')` e esiste un'`assegnazioni` attiva con `candidatura_id = OLD.id`: `RAISE EXCEPTION 'candidatura_con_assegnazione_attiva'`.
La UI mostra l'`AlertDialog` informativo introdotto la volta scorsa; il trigger blocca a livello DB i casi non passati dalla UI.

### D. Domini stato controllati

Aggiungere `CHECK` constraint **stabili** (no funzioni mutabili) sui valori ammessi:

- `candidature.stato IN ('ricevuta','in_valutazione','in_completamento','completata','approvata','rifiutata','ritirata')`
- `assegnazioni.stato IN ('attiva','conclusa','annullata')`
- `camere.stato IN ('libera','parzialmente_occupata','occupata','manutenzione','non_disponibile')`

### E. Log automatico cambio stato

Trigger `AFTER UPDATE ON candidature` quando `OLD.stato IS DISTINCT FROM NEW.stato`: insert in `log_stato_candidature` con `cambiato_da = auth.uid()`. Garantisce che la storia sia sempre tracciata anche se il codice client dimentica di farlo (oggi è scritto nei vari handler).

### F. Sincronia stato camera

Trigger `AFTER INSERT/UPDATE/DELETE ON assegnazioni`: ricalcola `camere.stato` in base al conteggio assegnazioni attive vs `posti`:

- 0 → `libera`
- 0 < n < posti → `parzialmente_occupata`
- n == posti → `occupata`
- non tocca `manutenzione` / `non_disponibile` (queste hanno precedenza).

Questo elimina la possibilità di drift tra realtà e campo `camere.stato`.

### Verifica pre-migrazione

Prima della migrazione esecutiva, lancio query di scoperta (read-only) per assicurarmi che **nessun record esistente** violi i nuovi vincoli (`posti < attive`, stati non in dominio, candidature approvate orfane di assegnazione, ecc.). Se trovo violazioni, le segnalo prima di applicare e propongo lo script di rimedio.

---

## Cosa NON facciamo

- Niente refactor della macchina a stati lato applicazione: i trigger sono additivi.
- Niente CHECK dipendenti da `now()` (Postgres li vieta come immutabili) — usiamo trigger per validazioni temporali se servono.
- Niente cleanup/cascade automatici su documenti e log: orfani gestiti solo a livello di warning UI, come deciso in precedenza.
- Nessuna modifica a edge function o form pubblico.

---

## Ordine di esecuzione

1. Verifica pre-migrazione (query read-only) sui dati attuali.
2. Implementazione UI Medio/Basso (Candidature, ConfigForm, Dashboard).
3. Migrazione DB con tutti i trigger/CHECK/indice in un'unica transazione.
4. Smoke test manuale dei flussi critici (assegnazione, cambio stato, riduzione posti, manutenzione).

## Domande aperte

1. Sui CHECK di dominio stati: vuoi includere già `in_completamento` e `completata` (sì di default, ma confermo)? -> si
2. Sul trigger F (sync stato camera): ok che `manutenzione` / `non_disponibile` abbiano precedenza e non vengano sovrascritti dal ricalcolo? In altre parole, finché una camera è in manutenzione, le assegnazioni storiche/future non cambiano automaticamente il suo stato visivo. -> ok
3. Sul trigger E (log auto): manteniamo anche il log lato applicazione (per il campo `note`), oppure ci affidiamo solo al trigger? Default proposto: **entrambi**, il trigger garantisce la riga base, l'app aggiunge `note` quando rilevanti. -> ok