## Obiettivo

Sostituire la modale di dettaglio candidatura con una pagina persona-centrica in `/admin/studenti/:id`, e unificare le azioni disponibili su una candidatura in un'unica sorgente condivisa fra lista e scheda.

## Nuova pagina `/admin/studenti/:id`

Route aggiunta in `src/App.tsx` sotto `AdminLayout`. La pagina imposta il titolo della top bar via `usePageTitle("Cognome Nome")` — nessun titolo stampato nel body.

Contenuto, nell'ordine:

1. **Anagrafica** — nome, email, telefono, nazionalità, data di nascita, codice fiscale. Se lo studente ha un'assegnazione attiva, riga "Attualmente a Cam. X · Struttura Y · dal <data>".
2. **Blocchi candidatura** — uno per candidatura (`candidature` filtrata su `studente_id`, `created_at DESC`). Ogni blocco contiene tutto quello che oggi mostra la modale: header (stato + badge Form completo / Link attivo / Link scaduto / Esito da comunicare / Esito inviato + data), sezioni `Dati studente`, `Dati accademici`, `Preferenze`, `Stile di vita` (se `versione_form === 'completa'`), `Garante` (se presente), `Stato form`, messaggio, documenti (query `documenti` per `candidatura_id`, `DocumentoRow` con signed URL), cronologia (`log_stato_candidature` per `candidatura_id`, ordine cronologico), azioni rese da `<CandidaturaActions.Buttons candidatura={c} />`, e textarea `note_admin`.
3. **Soggiorni** — `assegnazioni` per `studente_id` (attivi e conclusi) con camera, struttura, `data_inizio → data_fine` (o "in corso") e durata calcolata.

### Stati vuoti e id inesistente (requisito 4)

- Query studente con `.maybeSingle()`. Se `data` è `null` a fetch completato: rendo empty state (`User` icona dimmed + "Persona non trovata") + link "Torna alle candidature". Nessun throw.
- Se lo studente esiste ma non ha candidature: empty state dedicato dentro la sezione blocchi ("Nessuna candidatura per questa persona").
- Se non ha assegnazioni: empty state analogo nella sezione soggiorni.
- Loading iniziale: `<p className="text-muted-foreground">Caricamento...</p>` come altrove.

### Evidenziazione blocco da query param (requisito 1)

`?candidatura=<id>` — l'highlight parte SOLO quando i dati sono resi. Uso `useEffect` con dipendenze `[candidature, candidaturaParam]`: se `candidature` non è ancora arrivato o non contiene un blocco con quell'id, non fa nulla. Quando appare, `document.getElementById(...)` + `scrollIntoView({block:'start'})` e applico classe `ring-2 ring-primary/40` per ~1500ms. Se l'id non appartiene alla persona o non esiste, nessuna azione, nessun toast, nessun errore.

## Sorgente unica delle azioni

Nuovo modulo `src/lib/candidaturaActions.ts`:

```ts
type CandidaturaActionId =
  | 'invia_form_completo' | 'invia_esito' | 'approva' | 'rifiuta'
  | 'riapri' | 'segna_rinuncia' | 'assegna_camera' | 'contatta' | 'elimina';

interface CandidaturaAction {
  id: CandidaturaActionId;
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  group: 'stato' | 'operativa' | 'pericolosa';
}

function getAvailableActions(c: CandidaturaLike): CandidaturaAction[];
```

Le regole di disponibilità (stato + `versione_form` + `esito_email_stato` + `token_scade_il`) vivono solo qui.

Nuovo componente `src/components/admin/CandidaturaActions.tsx` con due varianti:
- `<CandidaturaActions.Menu candidatura={c} />` per il menu di riga (dentro `RowActions` con `DropdownMenuItem`).
- `<CandidaturaActions.Buttons candidatura={c} />` per il blocco scheda (`Button size="sm"` in flex-wrap).

Entrambe iterano `getAvailableActions(c)` e chiamano handler passando `c`.

### Hook condiviso, singola istanza per pagina (requisito 2)

`src/hooks/useCandidaturaActions.tsx` espone `{ trigger, dialogs }`:

- `trigger(actionId, candidatura)` — chiama sincronizzando lo stato del dialog corrispondente sulla candidatura passata al momento. Nessuno stato "candidatura corrente" implicito.
- `dialogs` — un unico React node che monta i dialog una sola volta: `AlertDialog` cambio stato, dialog invio link, dialog invio esito, `AlertDialog` conferma rigenerazione link, `AlertDialog` elimina. Ogni dialog tiene `target` interno impostato da `trigger`, così agisce sempre sulla candidatura giusta.

Regola d'uso: **istanziare l'hook una sola volta**, nella pagina (Candidature per la lista, StudentePage per la scheda). `CandidaturaActions.Menu` / `.Buttons` ricevono `trigger` via un `CandidaturaActionsContext` messo dalla pagina attorno al proprio contenuto, per non forzare prop-drilling attraverso più blocchi. `dialogs` viene renderizzato in coda alla pagina.

Sulla scheda persona, quindi, esiste **un solo** set di dialog condivisi da tutti i blocchi.

### Invalidazioni preservate (requisito 3)

Ricognizione delle mutazioni oggi in `src/pages/admin/Candidature.tsx`:

| Mutazione | Invalidazioni attuali |
|---|---|
| `updateStato` (cambio stato + insert su `log_stato_candidature`) | `['candidature']`, `['studenti-approvati']`, `['dashboard-stats']` + toast "Stato aggiornato" |
| `deleteCandidatura` | `['candidature']`, `['dashboard-stats']` + toast "Candidatura eliminata" + chiusura target + chiusura selected |
| `sendEsito` (edge fn `send-esito-email`) | `['candidature']`, `['dashboard-stats']` + toast "Comunicazione esito inviata" + reset target/nota |
| `generateLink` (edge fn `generate-completion-link`, success ramo) | `['candidature']` |

Tutte spostate integralmente dentro `useCandidaturaActions.tsx`, mantenendo:
- gli stessi query key,
- gli stessi toast (successo ed errore, con `variant: 'destructive'` quando previsto),
- lo stesso reset di stato locale (target, nota, linkData, linkCopied),
- lo stesso comportamento del ramo "regen conferma" per `generateLink` quando esiste un token attivo non scaduto.

Aggiungo inoltre — così le pagine che leggono le nuove query si aggiornano — `['studente', id]`, `['studente-candidature', id]`, `['studente-assegnazioni', id]`, `['studente-log', id]`, `['studente-documenti', id]` alle invalidazioni di `updateStato`, `deleteCandidatura`, `sendEsito`, `generateLink` (in modo coerente con l'ambito toccato). Nessuna invalidazione esistente viene rimossa.

### Note admin — riscontro visibile e coerenza (nota minore)

Verificato in `Candidature.tsx`: `updateStato.mutationFn` fa `update({ stato, note_admin: note ?? undefined })`. Il chiamante (`requestStatoChange`) non passa `note`, quindi in pratica il campo `note_admin` non viene sovrascritto dai cambi stato — ma la definizione della mutazione lo permette e crea un punto di sovrascrittura latente.

Interventi:
- La textarea `note_admin` salva onBlur e mostra ora un feedback visibile: micro-badge "Salvato" accanto al titolo per ~2s dopo il save, in aggiunta al toast già presente in caso di errore. Aggiungo anche toast di successo "Nota salvata" (già presente oggi ma solo nella modale — mantengo il pattern).
- `updateStato` in `useCandidaturaActions` rimuove `note_admin` dal payload di update: cambia solo `stato`. Le note restano di competenza esclusiva della textarea. In questo modo i due punti di scrittura non possono più sovrapporsi.
- Nessun cambio di comportamento visibile per l'utente: nessuna azione oggi passa `note` a `updateStato`.

## Differenze fra menu (riga) e azioni (modale) attuali, risolte

| Azione | Menu di riga (oggi) | Modale (oggi) | Dopo |
|---|---|---|---|
| Invia form completo (`versione_form !== 'completa'`) | Sì | **No** | Sì in entrambi |
| Invia comunicazione esito (`approvata/rifiutata` + `esito_email_stato='da_inviare'`) | Sì | **No** | Sì in entrambi |
| Approva / Rifiuta (`ricevuta` o `completata`) | Sì | Sì | Uguale |
| Riapri (`approvata` o `rifiutata`) | Sì | Sì | Uguale |
| Segna come rinuncia (tutti tranne `ritirata`, `sostituita`) | Sì | **No** | Sì in entrambi |
| Assegna a camera (`approvata`) | Sì | Sì | Uguale |
| Contatta studente (email presente) | Sì | Sì | Uguale |
| Elimina candidatura | Sì | **No** | Sì in entrambi (comportamento invariato) |

Le voci mancanti nella modale vengono ripristinate perché la scheda è il posto naturale per lavorare in profondità. Nessuna azione aggiunta o rimossa rispetto all'unione dei due elenchi.

## Modifiche di navigazione

- `src/pages/admin/Candidature.tsx`: il click sulla riga naviga a `/admin/studenti/<studente_id>?candidatura=<candidatura_id>`. Rimossa la `Dialog` di dettaglio e lo stato `selected` + `documenti`. Il menu di riga usa `<CandidaturaActions.Menu>`; l'hook `useCandidaturaActions` è istanziato una volta a livello pagina e i suoi `dialogs` sono renderizzati in coda.
- `src/pages/admin/Residenti.tsx`: **anche** il click sulla riga porta a `/admin/studenti/<studente_id>` (allineamento con Candidature — nota minore). La voce di menu "Visualizza profilo" resta e ha la stessa destinazione. Rimossa la `Dialog` profilo e la query `storico`.
- `src/hooks/usePageTitle.ts`: nessuna modifica alla mappa; titolo persona via override.

## Componenti condivisi estratti

- `src/components/admin/candidatura/CandidaturaDetail.tsx` — un blocco candidatura completo (sezioni + documenti + cronologia + azioni + note). Accetta `candidatura`, `documenti`, `log`, opzionale `highlight`.
- `src/components/admin/candidatura/DocumentoRow.tsx` — estratto.
- `src/components/admin/candidatura/Section.tsx` — estratto.
- `src/components/admin/candidatura/CandidaturaBadges.tsx` — badge stato + form completo + link + esito.
- `src/components/admin/candidatura/CandidaturaActionsContext.tsx` — context per esporre `trigger` ai componenti azione senza prop-drilling.

## Vincoli rispettati

- Nessuna modifica DB / trigger / stati.
- Nessuna perdita di informazione rispetto alla modale.
- Export XLSX in `Candidature.tsx` invariato.
- Titolo pagina impostato via `usePageTitle`.
- Design system: token, `motion.div` standard, `RowActions`, `AlertDialog` per azioni distruttive, empty state con icona dimmed + testo `text-[13px] text-muted-foreground`.
- Eliminazione candidatura invariata (verrà rivista in un passaggio successivo).

## File creati

- `src/pages/admin/StudentePage.tsx`
- `src/lib/candidaturaActions.ts`
- `src/hooks/useCandidaturaActions.tsx`
- `src/components/admin/CandidaturaActions.tsx`
- `src/components/admin/candidatura/CandidaturaDetail.tsx`
- `src/components/admin/candidatura/DocumentoRow.tsx`
- `src/components/admin/candidatura/Section.tsx`
- `src/components/admin/candidatura/CandidaturaBadges.tsx`
- `src/components/admin/candidatura/CandidaturaActionsContext.tsx`

## File modificati

- `src/App.tsx` — nuova route `studenti/:id`.
- `src/pages/admin/Candidature.tsx` — rimossa modale dettaglio e mutazioni locali; riga naviga alla scheda; menu di riga usa `CandidaturaActions.Menu`; `useCandidaturaActions` istanziato una volta.
- `src/pages/admin/Residenti.tsx` — rimossa modale profilo; click riga + voce menu navigano alla scheda.

## File eliminati

Nessuno (le modali eliminate erano inline nei file modificati).

## Deliverable finale

Al termine riferirò: file creati/modificati, lista invalidazioni preservate (contro l'elenco qui sopra), e conferma che l'hook azioni è istanziato una sola volta per pagina.
