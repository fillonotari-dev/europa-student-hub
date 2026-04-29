## Configurazione campi e documenti extra del form di candidatura

L'admin potrà aggiungere/modificare/disattivare campi e documenti extra che appaiono in coda al form di candidatura, senza toccare i campi core (anagrafici, accademici, preferenze, documenti standard).

### 1. Database

Due nuove tabelle + colonna su `candidature`.

**`form_campi_custom`** — campi extra configurabili
- `id` (uuid, pk)
- `chiave` (text, unique) — identificatore stabile usato come chiave nel JSON delle risposte (es. `preferenze_alimentari`)
- `tipo` (text) — uno tra: `text`, `textarea`, `number`, `date`, `boolean`, `select`, `multiselect`
- `label_it`, `label_en` (text)
- `descrizione_it`, `descrizione_en` (text, nullable) — testo di aiuto sotto il campo
- `opzioni` (jsonb, nullable) — array di `{ value, label_it, label_en }` per `select`/`multiselect`
- `obbligatorio` (boolean, default false)
- `attivo` (boolean, default true)
- `ordine` (integer, default 0)
- `created_at`, `updated_at`

**`form_documenti_custom`** — documenti extra configurabili
- `id` (uuid, pk)
- `chiave` (text, unique) — usata come `tipo` nella tabella `documenti` esistente
- `label_it`, `label_en` (text)
- `descrizione_it`, `descrizione_en` (text, nullable)
- `obbligatorio` (boolean, default false)
- `attivo` (boolean, default true)
- `ordine` (integer, default 0)
- `created_at`, `updated_at`

**Nuova colonna su `candidature`**
- `risposte_custom` (jsonb, default `{}`) — mappa `chiave -> valore` per i campi extra di quella candidatura

**RLS**
- Admin: full access su entrambe le tabelle (pattern `has_role(auth.uid(), 'admin')`)
- Anon: SELECT su `attivo = true` per entrambe (necessario perché il form di candidatura è pubblico)

### 2. Form pubblico — `src/pages/Candidatura.tsx`

- Nuova `useQuery` per leggere campi e documenti custom attivi (ordinati per `ordine`).
- Se almeno un campo o documento custom è attivo, viene aggiunto uno step **"Informazioni aggiuntive"** subito prima di "Riepilogo".
- Componente `CustomFieldRenderer` che switcha sul `tipo` e renderizza:
  - `text`/`number`/`date` → `Input`
  - `textarea` → `Textarea`
  - `boolean` → `Switch` o `Checkbox`
  - `select` → `Select` shadcn
  - `multiselect` → lista di `Checkbox` (semplice e accessibile)
- I documenti custom usano lo stesso `FileUpload` già presente.
- Validazione step: campi/documenti `obbligatorio = true` devono essere compilati.
- Riepilogo: nuova `ReviewSection` che elenca tutti i valori extra con label nella lingua corrente.
- Submit: i valori vengono inviati alla edge function come `risposte_custom: { chiave: valore }`; i documenti custom vengono caricati nel bucket esistente con `tipo = chiave_documento`.

### 3. Edge function — `supabase/functions/submit-candidatura/index.ts`

- Accetta nuovo campo `risposte_custom` nel body.
- Validazione server-side: per ogni campo custom `attivo = true` e `obbligatorio = true`, verifica che la chiave sia presente in `risposte_custom`. Se manca, ritorna 400.
- Salva `risposte_custom` nella riga di `candidature` insieme agli altri snapshot.
- I documenti custom passano già attraverso il loop `documenti` esistente (con `tipo = chiave`).

### 4. Nuova pagina admin — `src/pages/admin/ConfigForm.tsx`

Una pagina con due tab (`Tabs` shadcn): **Campi extra** e **Documenti extra**.

Ogni tab ha:
- Tabella con: ordine (drag handle o frecce su/giù), chiave, label IT, tipo (solo per campi), obbligatorio, attivo (switch inline), azioni (modifica, elimina).
- Pulsante "Aggiungi" che apre un `Dialog` con form (label IT/EN, chiave auto-generata da label IT, tipo, obbligatorio, descrizioni opzionali, opzioni per select/multiselect).
- Validazione: la `chiave` deve essere snake_case alfanumerico; non può essere modificata dopo la creazione (per non rompere i `risposte_custom` storici).
- Eliminazione con `AlertDialog` di conferma. Avviso se il campo è già stato usato in candidature esistenti (eliminazione comunque permessa: i dati storici restano nel JSON ma non vengono più mostrati con label "amichevole" — solo la chiave).
- Riordino tramite frecce su/giù (semplice, niente drag-and-drop per ora) che aggiorna `ordine`.

Pattern UI coerente con `Strutture.tsx`: card list, header con titolo + bottone aggiungi, `useQuery` + `useMutation`, `toast` su success/error, validazione con `zod`.

### 5. Vista admin candidatura dettaglio — `src/pages/admin/Candidature.tsx`

- Quando si apre una candidatura, oltre alle sezioni esistenti, viene mostrata una sezione **"Informazioni aggiuntive"** che itera su `form_campi_custom` (anche disattivati) e mostra label IT + valore da `risposte_custom`. Per chiavi presenti nel JSON ma non più in tabella, mostra la chiave grezza.
- I documenti custom appaiono già nella sezione "Documenti caricati" esistente (dato che usano la stessa tabella `documenti`); estendiamo la mappa `TIPO_DOC_LABELS` leggendo `form_documenti_custom` per avere label corrette.

### 6. Export XLSX

In `src/pages/admin/Candidature.tsx`, l'export XLSX viene esteso per includere una colonna per ogni campo custom attivo, con il valore preso da `risposte_custom`. Per `multiselect` i valori vengono uniti con `, `.

### 7. Sidebar e routing

- Aggiungere voce **"Configurazione form"** in `AdminSidebar` (icona `Settings2` o `SlidersHorizontal` di lucide), in fondo prima di "Storico".
- Registrare la route `/admin/config-form` in `src/App.tsx`.

### 8. Dettagli tecnici

- `risposte_custom` resta JSON snapshot: cancellare un campo dalla configurazione **non** rompe le candidature passate, ma l'admin perde la label "amichevole" per quel campo nelle candidature storiche (mostriamo la chiave). Documentato nell'avviso di eliminazione.
- I tipi `select` e `multiselect` usano array di opzioni in `opzioni`. Quando si elimina un'opzione mai usata, ok; se è già usata, viene mostrato un warning.
- La edge function valida sempre lato server l'obbligatorietà, indipendentemente da quello che fa il client.
- Le validazioni di formato (es. lunghezza max 1000 char per text/textarea, max 100 per chiave) sono codificate sia in zod (admin) sia nella edge function.

### File creati / modificati

```text
NEW  src/pages/admin/ConfigForm.tsx
NEW  migration: form_campi_custom, form_documenti_custom, candidature.risposte_custom + RLS
EDIT src/pages/Candidatura.tsx                        (step + render + submit dei campi custom)
EDIT supabase/functions/submit-candidatura/index.ts   (accetta + valida + salva risposte_custom)
EDIT src/pages/admin/Candidature.tsx                  (sezione "Informazioni aggiuntive" + label doc custom + export esteso)
EDIT src/components/admin/AdminSidebar.tsx            (voce "Configurazione form")
EDIT src/App.tsx                                      (route /admin/config-form)
EDIT src/i18n/translations.ts                         (chiavi: stepInfoAggiuntive, infoAggiuntive)
```

### Cosa rimane fuori (per ora)

- Riordino drag-and-drop (usiamo frecce su/giù).
- Logica condizionale tra campi (es. "mostra X solo se Y = sì").
- Modifica dei campi core (anagrafici, accademici, ecc.) — per design.
- Eliminare/riordinare i 2 documenti standard (`documento_identita`, `certificato_iscrizione`) — per design restano fissi.

Se domani serve uno di questi, è un'estensione naturale di questa base.
