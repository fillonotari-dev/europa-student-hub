## Intervento — Cinque pagine, uno stadio unico, ricerca globale (rev.3)

Rifondazione della navigazione admin attorno a `v_studenti_stadio` e `camere_disponibilita`. Nessuna migration, nessun ricalcolo locale di stadio od occupazione.

### 0. Documentazione (prima di tutto)
`docs/Context.md`:
- Riscrivere gli stadi con i valori reali della vista: `in_casa, assegnato, da_valutare, in_attesa_studente, da_decidere, in_attesa_posto, archiviato`.
- Verificare che `camere_disponibilita` e vincolo GIST siano descritti con intervalli CHIUSI `[]` (data_fine = ultimo giorno incluso).

### 1. Helper query condiviso
Nuovo `src/lib/studentiQuery.ts`: due query lato client
1. `v_studenti_stadio` filtrata per stadi della lista → id + colonne base
2. tabella dettaglio (`candidature` o `studenti`) filtrata sugli id
3. una query su `strutture` per risolvere i nomi (no embed per riga)
4. join per id lato client

Nessuna paginazione server. Filtri/sort/pagina lato client.

### 2. Etichette e colori — due mappe separate
`src/lib/statoCandidatura.ts` copre solo i 6 stati candidatura; le liste mostrano lo STADIO (7 valori).

Due mappe distinte:
- `STATO_CANDIDATURA_COLORS` + `formatStatoCandidatura` — per la cronologia
- `STADIO_COLORS` + `formatStadio` — per le liste, copre tutti e 7 gli stadi

Aggiornare `src/components/admin/candidatura/CandidaturaBadges.tsx`: sdoppiare in `StadioBadge` (liste + testata scheda) e `StatoCandidaturaBadge`.

La timeline dei log vive in `src/components/admin/candidatura/CandidaturaDetail.tsx` (verificato: linee 63 e 194–200 usano `log_stato_candidature` + `formatStato`). Lì sostituire `formatStato` → `formatStatoCandidatura`.

### 3. Le due liste
`Candidature.tsx` — stadi `da_valutare, in_attesa_studente, da_decidere, in_attesa_posto`. Colonne: nome, stadio, struttura, arrivo previsto, tipo camera preferito, priorità, badge documenti/link, data invio. Ordinabile per priorità (NULL in fondo).

`Residenti.tsx` — stadi `assegnato, in_casa`. Colonne: nome, stadio, struttura, camera, posto, data inizio, data fine. Filtro "in arrivo" per isolare `assegnato`.

Entrambe: filtro archiviati OFF di default con contatore; filtro sede locale (query param); stato in query params; clic riga → `/admin/studenti/:id` con URL di ritorno.

### 4. Rimozione filtro sede globale
Consumatori: `Dashboard.tsx`, `Candidature.tsx`, `Camere.tsx`, `Residenti.tsx`, `AdminLayout.tsx`, `StrutturaSelect.tsx`. `Strutture.tsx` no.
- Eliminare `useStrutturaFilter.ts` e `StrutturaSelect.tsx`
- Rimuovere provider/select dalla top bar
- Filtro sede locale (query param) nelle tre pagine

### 5. Ricerca globale in top bar
Interroga `v_studenti_stadio` su nome/cognome/email, TUTTI gli stadi (archiviati inclusi). Risultati con `StadioBadge`, apre `/admin/studenti/:id`.

### 6. Home (`Dashboard.tsx`) — due blocchi

Blocco "Da fare" (righe cliccabili → lista pre-filtrata):
- N `da_valutare`, N `da_decidere`
- N `in_attesa_studente` > 7 giorni
- N link completamento scaduti
- N esiti da comunicare (`accolta`/`rifiutata` con `esito_email_inviata_il IS NULL`)
- N soggiorni in scadenza ≤ 30 gg
- N soggiorni scaduti da chiudere (assegnazioni `attiva` con `data_fine < CURRENT_DATE`)

Blocco "Stato dello studentato" — per sede, affiancati:
- posti occupati/totale via `camere_disponibilita(CURRENT_DATE, CURRENT_DATE, <struttura>)`
- ingressi previsti ≤ 30 gg
- camere in manutenzione

### 7. Azioni per stadio (`candidaturaActions.ts` + `useCandidaturaActions.tsx`)
`getAvailableActions(input)` con input **stadio**. Principale = pulsante pieno.

| Stadio | Principale | Secondarie |
|---|---|---|
| da_valutare | Chiedi dati completi | Rifiuta, Contatta, Elimina |
| in_attesa_studente | — | Rinvia link, Contatta, Rifiuta, Elimina |
| da_decidere | Assegna camera | Metti in lista d'attesa, Rifiuta, Contatta, Elimina |
| in_attesa_posto | Assegna camera | Rifiuta, Contatta, Elimina |
| assegnato | — | Trasferisci, Contatta, Annulla assegnazione |
| in_casa | — | Trasferisci, Contatta, Concludi soggiorno |
| archiviato | — | Contatta, Elimina (solo se mai assegnato) |

Rimuovere `riapri`, `segna_rinuncia`, `reopenStato` e handler.

**Metti in lista d'attesa**: dialogo con campo numerico Priorità (int, opzionale). Setta `stato → in_attesa_posto` e scrive `candidature.priorita`. Priorità editabile inline in lista dallo stadio `in_attesa_posto`. Ordinamento ASC, NULL in fondo.

**Annulla assegnazione** (solo stadio `assegnato`): AlertDialog di conferma. Nella stessa operazione:
1. `DELETE FROM assegnazioni WHERE id = …`
2. `UPDATE candidature SET stato='da_decidere', esito_email_inviata_il=NULL, esito_email_nota=NULL WHERE id=<candidatura_id>`

Senza l'azzeramento email, alla decisione successiva quella persona non ricompare fra "esiti da comunicare".

Lista e scheda studente leggono azioni SOLO da questa funzione.

### 8. Flusso "Assegna una camera" (Camere.tsx)
Azione principale di `da_decidere` e `in_attesa_posto`. Correzioni obbligatorie:

**(a) Query candidati selezionabili**: `studentiApprovati` oggi filtra `.eq('stato','accolta')`. Estendere a `.in('stato', ['da_decidere','in_attesa_posto','accolta'])` — altrimenti chi arriva da `da_decidere` non è selezionabile.

**(b) Mutazione `assegna`**: nella stessa operazione:
1. `INSERT INTO assegnazioni …`
2. `UPDATE candidature SET stato='accolta' WHERE id=<candidatura_id>` (idempotente se già `accolta`)

Approvare e assegnare sono lo stesso gesto. Senza (2), la persona compare correttamente in Residenti (lo stadio arriva dall'assegnazione) ma NON entra nel contatore "esiti da comunicare" e l'email non parte.

**(c) Preselezione**: se URL contiene `?candidatura=<id>`, preselezionare quella candidatura nel dialogo.

NON costruire in questo intervento: vista compagni di stanza, verifica periodo contestuale, assegnazione multi-posto.

### 9. `StudentePage.tsx` — allineamento
NON riprogettare. Solo:
- leggere lo **stadio** da `v_studenti_stadio` per lo studente
- passarlo a `getAvailableActions` (input stadio, non `c.stato`)
- badge di testata → `StadioBadge`
- rimuovere riferimenti alle azioni eliminate (`riapri`, `segna_rinuncia`) e a `reopenStato`
- sostituire `any` residui sui props azioni

Layout, ordine sezioni, timeline log invariati (usa `formatStatoCandidatura`).

### 10. Storico: rimozione + redirect
- Eliminare `src/pages/admin/storico/` intera
- Rimuovere import/route da `App.tsx` e voce in `AdminSidebar.tsx`
- Redirect:
  - `/admin/storico/candidature` → `/admin/candidature?archiviati=1`
  - `/admin/storico/residenti` → `/admin/residenti?archiviati=1`
  - `/admin/storico/camere` → `/admin/camere`
  - `/admin/storico` → `/admin/residenti?archiviati=1`

### 11. Export
Rifare `ExportButton.tsx` + `exportXlsx.ts`: due profili (Candidature/Residenti), colonne rispettive, VISTA CORRENTE filtrata. Verificare no colonne rimosse.

### Vincoli
- Nessun ricalcolo locale di stadio o occupazione
- Nessuna migration
- Design system invariato

### Verifiche finali
- Con filtri archiviati SPENTI in entrambe le liste:
  `count(Candidature) + count(Residenti) + count(archiviato) = count(*) v_studenti_stadio` (archiviati una sola volta)
- Persona con assegnazione futura → Residenti/`assegnato`, non in Candidature
- Ricerca globale trova archiviati con badge stadio e apre la scheda
- `useStrutturaFilter` zero consumatori residui
- Redirect `/admin/storico/*` funzionanti
- Posti occupati Home invariati con assegnazione futura registrata
- `StudentePage` mostra le azioni della tabella §7 per lo stadio corrente
- **Flusso assegna end-to-end**: da candidatura in `da_decidere` → "Assegna camera" → completare. Verificare:
  (i) compare in Residenti con `assegnato` o `in_casa`
  (ii) `candidature.stato = 'accolta'`
  (iii) Home la conta fra "esiti da comunicare"
  Se (i)(ii) tornano e (iii) no, lo stato candidatura non è stato scritto.

### Ordine di esecuzione
1. `Context.md` (§0)
2. Due mappe stato/stadio + badge sdoppiati + `CandidaturaDetail.tsx` (§2)
3. Helper query (§1)
4. Azioni per stadio, priorità, Annulla assegnazione con reset esito (§7)
5. Camere.tsx: query estesa + update stato in assegna + preselezione (§8)
6. `StudentePage.tsx` (§9)
7. Candidature + Residenti riscritte con filtro sede locale (§3)
8. Rimozione `useStrutturaFilter`/StrutturaSelect (§4)
9. Ricerca globale (§5)
10. Home (§6)
11. Storico + redirect (§10)
12. Export (§11)
13. Typecheck + checklist verifiche
