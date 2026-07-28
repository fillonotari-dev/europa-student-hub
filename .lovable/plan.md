
## Perimetro

Un solo file toccato in profondità: `src/pages/admin/StudentePage.tsx`. `CandidaturaDetail.tsx` viene ridotto (rimozione di `CandidaturaActions.Buttons` in header e delle ripetizioni anagrafiche; resta per l'eventuale vista compatta delle candidature secondarie). Nessuna migration, nessuna RPC nuova, `getAvailableActions` invariato, validazioni importate da `@shared/*` (alias confermato in `vite.config.ts` e `tsconfig.app.json`).

## 1 — Ordine e disposizione delle sezioni

Griglia a 2 colonne da `md` in su (`grid md:grid-cols-2 gap-6 items-start` — `items-start` impedisce lo stretch delle coppie affiancate); sotto `md` tutto collassa in colonna singola nello stesso ordine.

1. **Intestazione** — riga singola: nome+cognome a sinistra + badge stadio (`formatStadio(stadioRow.stadio)`); azioni a destra (`CandidaturaActions.Buttons` sulla candidatura di riferimento `c.id === stadioRow.candidatura_id`).
2. **Soggiorno** — `md:col-span-2` (larghezza piena). Solo se `assegnazioni.length > 0` (§2).
3. **Informazioni personali** — `md:col-span-2`. All'interno, i campi su due colonne (`grid sm:grid-cols-2 gap-x-6 gap-y-3`). Modalità Modifica (§4).
4. **Dati accademici** e **Preferenze** — affiancati (una colonna della griglia esterna ciascuno). Preferenze include gli avvisi coerenza date (§3).
5. **Caratteristiche** e **Garante** — affiancati. Caratteristiche visibile solo se `versione_form === 'completa'`; se manca, Garante prende una colonna singola senza forzare l'altra.
6. **Cronologia** — `md:col-span-2`, in fondo (§5).

Le sezioni 3–7 leggono dall'oggetto candidatura di riferimento (uno solo). Il ciclo `candidatureDecorated.map` viene rimosso dalla pagina. Se `candidature.length > 1`, in fondo un collassabile "Altre N candidature" che riusa `CandidaturaDetail` in sola lettura.

## 2 — Blocco Soggiorno

Solo se esiste ≥1 assegnazione. Due parti:

- **Attive** (`stato === 'attiva'`), ordinate per `data_inizio` asc. Per ognuna: struttura · camera · posto; `data_inizio` → `data_fine` (o "—"); etichetta calcolata a video confrontando con oggi:
  - `oggi < data_inizio` → "Non ancora iniziato"
  - `data_inizio <= oggi <= (data_fine ?? +∞)` → "In corso"
  - motivo chiusura se presente.
  - Compagno di stanza (§sotto).
- **Concluse**: righe compatte `Cam. N · struttura · dal → al · motivo_chiusura`.

**Compagno di stanza — UNA sola query, calcolo lato client.**

- Query unica `useQuery(['studente-compagni', studenteId, cameraIds.sort().join(',')])`, `enabled: cameraIds.length > 0`: `assegnazioni.select('id, camera_id, data_inizio, data_fine, studente_id, studenti(id, nome, cognome)').in('camera_id', cameraIds).eq('stato', 'attiva').neq('studente_id', studenteId)`. Nessun filtro `lte/gte` su date (escluderebbe le assegnazioni con `data_fine` nulla).
- Sovrapposizione calcolata in JS, estremi inclusi, `data_fine` nulla = `+∞`:
  `inizioA <= (fineB ?? +∞) && inizioB <= (fineA ?? +∞)`.
- Per ogni assegnazione attiva della persona, filtro il set per stessa `camera_id` + periodo sovrapposto e mostro compagno/i come link `/admin/studenti/{id}?from=residenti`. Nessun vincolo `posti === 2`.

## 3 — Avvisi coerenza date

Callout non bloccante dentro Preferenze (`bg-warning/10 border-warning/30`), lista di:
- `periodo_fine <= periodo_inizio`: "La data di fine periodo non è successiva alla data di inizio."
- `data_arrivo_prevista` fuori da `[periodo_inizio, periodo_fine]`: "La data di arrivo prevista è fuori dal periodo indicato."

Nessun controllo su `anno_accademico`.

## 4 — Modifica anagrafica

Pulsante `Modifica` nell'header di "Informazioni personali". In edit, gli stessi campi in lettura diventano input nella stessa griglia a due colonne; footer `Salva`/`Annulla`.

**Indirizzo di residenza**:
- LETTURA: riga unica composta `via civico — CAP comune (provincia)`; la nazione solo se diversa da `IT`. Occupa una singola cella nella griglia dei campi.
- MODIFICA: sei campi separati (via, civico, CAP, comune, provincia, nazione) con le rispettive validazioni. Nessun campo indirizzo di testo libero, in nessuna modalità.

Campi editabili: nome, cognome, telefono, data nascita (`DateOfBirthPicker`), nazionalità (`src/lib/nationalities.ts`), CF + `cf_non_disponibile`, i sei campi indirizzo, `documento_identita_n` (→ candidatura di riferimento), email (§sotto).

**Validazioni** — import da `@shared`:
- `validateCodiceFiscale` da `@shared/codice-fiscale`
- `PROVINCE` da `@shared/province`; provincia obbligatoria se nazione = IT
- CAP `/^\d{5}$/` se nazione = IT
- nazione dalla lista `@shared/countries`

**Nessuna transazione lato client — scritture ordinate per rischio.**

1. `update studenti` con tutti i campi anagrafici, **inclusa l'email**. Se fallisce con `23505` sull'email → toast: "L'indirizzo *X* è già usato da un'altra persona." Nessuna scrittura ulteriore. Altri errori → messaggio dell'errore, non generico.
2. Solo se il primo riesce e `documento_identita_n` è cambiato: `update candidature` sulla candidatura di riferimento. Se fallisce, toast esplicito: "Anagrafica salvata, numero documento non aggiornato: *messaggio*." La UI resta in edit sul solo campo documento.
3. Successo pieno → `invalidateQueries` su `['studente', id]`, `['studente-candidature', id]`, `['studente-stadio', id]`, `['candidature']`.

**Email** — `AlertDialog` di conferma prima della sequenza.

Non editabili da qui: stato/stadio/priorità/camera/date soggiorno.

## 5 — Cronologia

Estratta a livello di pagina, sulla candidatura di riferimento:
- transizione se `stato_precedente !== stato_nuovo` (icona freccia)
- evento se `stato_precedente === stato_nuovo` (icona nota); `l.note` sempre in evidenza
- format con `formatStatoCandidatura`.

## Vincoli rispettati

- Nessuna migration, nessuna RPC nuova.
- `getAvailableActions` / `CandidaturaActions.*` invariati.
- Validazioni da `@shared/*` (alias già configurato — nessuna copia).
- `usePageTitle` / `usePageBack` / query params invariati; design system invariato.

## Verifiche

1. `md+`: Intestazione, Soggiorno, Informazioni personali e Cronologia occupano l'intera larghezza; Dati accademici↔Preferenze e Caratteristiche↔Garante appaiono affiancati, allineati in alto (non stirati). Sotto `md`: colonna unica nell'ordine.
2. Indirizzo in lettura è una sola riga composta; in modifica sono sei input separati; nessun campo unico free-text da nessuna parte.
3. Persona `in_casa`: Soggiorno subito dopo l'intestazione con camera/posto/date/compagno. Persona `da_valutare`: Soggiorno assente.
4. `grep 'CandidaturaActions.Buttons'` mostra un'unica occorrenza attiva (pagina).
5. CF con carattere di controllo errato in modifica → rifiutato con lo stesso messaggio del modulo pubblico.
6. Email duplicata → messaggio esplicito con l'indirizzo, nessuna update; documento non aggiornato → toast esplicito, anagrafica salvata.
7. Camera doppia con entrambi i posti occupati: entrambe le schede si vedono reciprocamente come compagno, con link. Compagno con `data_fine` nulla: appare comunque.
8. Console pulita al primo caricamento (nessun warning React sugli hook variabili).
9. Cronologia: transizioni ed eventi entrambi visibili; per gli eventi la nota è leggibile.
