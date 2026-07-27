## Contesto verificato
- Nessuna riga in `candidature` ha oggi `stato = 'in_valutazione'` (unica riga: `approvata`). Rimozione sicura, nessuna migrazione dati.
- Vincolo esistente: `candidature_stato_check` (elenco esplicito degli stati).
- Trigger da aggiornare: `public.candidature_check_stato_vs_assegnazione()` — elenca `in_valutazione` fra gli stati vietati quando esiste un'assegnazione attiva.
- Nessun altro trigger (`candidature_log_stato`, `candidature_flag_esito_email`) referenzia `in_valutazione`.

## Transizioni oggi condizionate a `in_valutazione` (da riscrivere, non rimuovere)

Ricognizione in `src/pages/admin/Candidature.tsx`:

| Azione | Condizione attuale | Problema | Nuova condizione |
|---|---|---|---|
| **Approva** | `stato === 'in_valutazione'` | senza riscrittura, nessuna candidatura sarebbe più approvabile | `stato === 'ricevuta' \|\| stato === 'completata'` |
| **Rifiuta** | `stato === 'in_valutazione'` | idem | `stato === 'ricevuta' \|\| stato === 'completata'` |
| **Prendi in carico** (→ `in_valutazione`) | `stato === 'ricevuta'` | azione da eliminare | rimossa |
| **Rimetti in valutazione** (→ `in_valutazione`) | `stato === 'approvata' \|\| stato === 'rifiutata'` | target inesistente | sostituita da **Riapri**: torna a `completata` se `versione_form === 'completa'` o `completamento_il` valorizzato, altrimenti a `ricevuta`. Condizione di visibilità invariata: `stato === 'approvata' \|\| stato === 'rifiutata'` |
| **Segna come rinuncia** (→ `ritirata`) | `stato !== 'ritirata' && stato !== 'sostituita'` | invariata (il valore `ritirata` resta) | invariata, solo label rinominata |

Applicato sia nel menu azioni di riga (`ActionsMenu`, righe ~311-360) sia nei bottoni dentro la scheda della candidatura (righe ~627-663).

Verifica esplicita richiesta dall'utente: **da `ricevuta` e da `completata` restano possibili Approva, Rifiuta e Segna come rinuncia**. Confermato dalle nuove condizioni.

## Migration (una sola)
1. `DROP` + ricrea `candidature_stato_check` con: `ricevuta, in_completamento, completata, approvata, rifiutata, ritirata, sostituita`.
2. `CREATE OR REPLACE FUNCTION public.candidature_check_stato_vs_assegnazione()` identica per linguaggio, `SET search_path = public` e logica, rimuovendo solo `'in_valutazione'` dall'array degli stati vietati. Nessuna `DROP TRIGGER` / `CREATE TRIGGER`.

Precheck già eseguito: 0 righe con `in_valutazione`. Se dovesse cambiare, la migration fallisce sul CHECK e ci si ferma.

## Etichette storiche sconosciute (nuovo requisito 2)

Attualmente il registro cambi stato (`StoricoCandidature.tsx`) stampa il valore grezzo se assente dalla mappa: `STATO_LABELS[l.stato_nuovo] ?? l.stato_nuovo`. Anche `RowActions`/badge nella pagina Candidature fanno lo stesso.

Introduco helper condiviso `src/lib/statoCandidatura.ts` con `formatStato(value)` che:
- restituisce l'etichetta dalla mappa se presente;
- altrimenti trasforma lo snake_case in stringa leggibile capitalizzata (es. `in_valutazione` → "In valutazione", `foo_bar` → "Foo bar").

Usato in `Candidature.tsx`, `Dashboard.tsx` e `StoricoCandidature.tsx` sia per `stato_nuovo` sia per `stato_precedente`. Vale per **qualunque** stato sconosciuto, non solo quello rimosso, così i log storici che ancora citano `in_valutazione` (se mai comparsi) restano leggibili senza esporre il tecnicismo grezzo.

## Modifiche codice

### `src/lib/statoCandidatura.ts` (nuovo)
- Mappa canonica `STATO_LABELS` (senza `in_valutazione`, con `ritirata: 'Rinuncia del candidato'`).
- `formatStato(value)` con fallback leggibile.
- Mappa `STATO_COLORS` (senza `in_valutazione`).

### `src/pages/admin/Candidature.tsx`
- Rimuovere `in_valutazione` da `STATI`, `STATO_ORDER`.
- Importare label/colori/`formatStato` dal nuovo modulo (rimuovere le mappe locali duplicate).
- `ActionsMenu`: rimuovere blocchi "Prendi in carico" e "Rimetti in valutazione", inserire nuove condizioni Approva/Rifiuta (visibili su `ricevuta` e `completata`) e nuovo bottone "Riapri" con logica descritta sopra.
- Sezione azioni dentro la scheda: stessi cambi.
- Rinominare "Segna come ritirata" → "Segna come rinuncia" e il testo di aiuto nel dialog di eliminazione.
- Aggiornare `requestStatoChange` guard (righe ~186) rimuovendo `nextStato === 'in_valutazione'`.

### `src/pages/admin/Dashboard.tsx`
- Rimuovere card "In valutazione" e query `candidatureInValutazione`.
- Aggiungere card "In attesa di decisione" = count `stato = 'completata'`.
- Nei task: voce "Candidature complete in attesa di decisione" → `/admin/candidature?stato=completata`.
- Usare `formatStato` per le badge; rimuovere mappe locali per `in_valutazione`; rinominare `ritirata`.

### `src/pages/admin/Strutture.tsx`
- Togliere `in_valutazione` da `pendenti` (resta `['ricevuta','in_completamento','completata']`).

### `src/pages/admin/storico/StoricoCandidature.tsx`
- Usare `formatStato` per `stato_nuovo` e `stato_precedente` (fallback leggibile).
- Rimuovere `in_valutazione` dalla mappa; rinominare `ritirata` → `Rinuncia del candidato`.

### `supabase/functions/submit-candidatura/index.ts`
- Nessuna modifica (non usa `in_valutazione`).

## Vincoli rispettati
- Nessuna modifica agli altri stati, ai trigger di logging (`candidature_log_stato`) e di esito email (`candidature_flag_esito_email`), né alle assegnazioni.
- Nessuna modifica al flusso di generazione del link di completamento.
- Il valore `ritirata` nel DB resta invariato: cambia solo la label ovunque compaia (Candidature, Dashboard, Storico, export XLSX che riusa `STATO_LABELS`).

## Deliverable finale
Al termine dell'implementazione riferirò: elenco file modificati, nome della migration creata, e condizioni riscritte (già anticipate qui sopra).