# "Nuovo soggiorno" trattato come inserimento manuale

Oggi la candidatura creata dal ramo "nuovo soggiorno" nasce senza origine (quindi trattata come arrivata dal form pubblico) e con `versione_form = 'interna'`. La allineiamo all'inserimento manuale.

## 1. Origine

In `src/hooks/useCandidaturaActions.tsx`, mutazione `assegnaSoggiorno`, ramo `mode === 'nuovo'`: la nuova riga candidatura viene creata con `origine: 'inserimento_manuale'`.

Effetti ereditati senza altro codice:
- `CandidaturaBadges.tsx`: niente badge di esito email;
- `candidaturaActions.ts`: niente azione "Comunica esito" (la condizione esclude già `origine !== 'inserimento_manuale'`);
- `statoDopoAnnullamento`: annullando l'assegnazione la persona torna in attesa posto, non "da decidere";
- `deveInviareEsito`: nessuna email automatica.

## 2. Valore unico di `versione_form`: `pre_screening`

Applicato in entrambe le strade: nella funzione di database `crea_persona_manuale` resta `pre_screening` (nessuna modifica necessaria) e il ramo "nuovo soggiorno" passa da `interna` a `pre_screening`.

Motivazione: tutti i punti che leggono `versione_form` fanno un solo confronto, `= 'completa'` oppure `!= 'completa'`. Non esiste alcun ramo che riconosca `interna`: è un terzo valore che nessuno legge, e che nelle schermate viene comunque già etichettato "Pre-screening". `pre_screening` è inoltre il valore predefinito della colonna.

Punti che leggono `versione_form` e cosa cambierebbe:

| Punto | Confronto | Cambio |
| --- | --- | --- |
| `src/components/admin/candidatura/CandidaturaBadges.tsx` (righe 26, 27, 31) | `=== 'completa'` / `!== 'completa'` | nessuno |
| `src/components/admin/candidatura/CandidaturaDetail.tsx` (128, 151) | `=== 'completa'` | nessuno (etichetta già "Pre-screening") |
| `src/pages/admin/StudentePage.tsx` (642) | `=== 'completa'` | nessuno |
| `src/pages/admin/Candidature.tsx` (198, export Excel) | `=== 'completa'` | nessuno (già scriveva "Pre-screening") |
| `src/lib/candidaturaActions.ts` (116, ramo `da_valutare`) | `!== 'completa'` | nessuno |
| `supabase/functions/generate-completion-link` (83) | `=== 'completa'` | nessuno |
| `supabase/functions/complete-candidatura`, `submit-candidatura` | scrivono `completa` / `pre_screening` | nessuno |

Nessun comportamento cambia rispetto a oggi: il valore `interna` era già indistinguibile da `pre_screening` in ogni ramo.

## 3. Verifiche richieste

- Badge "Form completo": mostrato solo con `= 'completa'`, quindi non compare.
- Ramo `da_valutare` di `getAvailableActions`: ramifica su `!== 'completa'`, comportamento identico. In pratica il ramo non viene nemmeno raggiunto, perché la candidatura da "nuovo soggiorno" nasce già `accolta`.

## 4. Righe esistenti

Nessuna modifica ai dati, nessuna migration. Situazione attuale (13 candidature):

| versione_form | origine | righe |
| --- | --- | --- |
| completa | form_pubblico | 8 |
| pre_screening | form_pubblico | 5 |

Nessuna riga ha oggi `versione_form = 'interna'` né `origine = 'inserimento_manuale'`: la modifica vale solo per le righe future.

## 5. Test

In `src/test/candidatura-actions.test.ts` si aggiunge il caso "candidatura da nuovo soggiorno non offre invia_esito": candidatura `stato: 'accolta'`, `origine: 'inserimento_manuale'`, `versione_form: 'pre_screening'` — l'elenco azioni non contiene `invia_esito`, e come controprova la stessa riga con `origine: 'form_pubblico'` lo contiene. Riporto l'esito della suite completa.

## 6. Elenco completo dei punti che creano una candidatura

Ricerca esaustiva su tutto il progetto (`insert` su `candidature` nel frontend, negli hook e nelle funzioni server, più gli `INSERT INTO public.candidature` nelle funzioni di database). Le porte sono tre, non di più:

| # | Punto | Quando | `origine` scritta |
| --- | --- | --- | --- |
| 1 | `supabase/functions/submit-candidatura/index.ts:298` | invio del form pubblico dal sito | non impostata esplicitamente → default della colonna `form_pubblico` (corretta) |
| 2 | Funzione di database `crea_persona_manuale` (migration `20260905130521`, riga 80) | "Aggiungi persona" in `/admin/residenti`, via `AggiungiPersonaDialog.tsx:161` | `inserimento_manuale` esplicita (corretta) |
| 3 | `src/hooks/useCandidaturaActions.tsx:366`, ramo `mode === 'nuovo'` | "Nuovo soggiorno" da scheda persona / liste | oggi nessun valore → eredita il default `form_pubblico`: è la riga da correggere |

Nessun altro punto inserisce in `candidature`. Le altre `insert` trovate riguardano `log_stato_candidature` (`submit-candidatura`, `send-esito-email`, `generate-completion-link`, `complete-candidatura`) e non creano candidature; `complete-candidatura` e `generate-completion-link` fanno solo `update` su righe esistenti.

Causa strutturale delle tre porte trovate una alla volta: la colonna `origine` ha default `'form_pubblico'`, quindi ogni nuova porta che dimentica il campo nasce come pubblica. Non tocchiamo il default in questo giro (nessuna modifica al database), ma resta il punto da sorvegliare per eventuali porte future.

## Fuori perimetro


Nessuna modifica al database, nessuna modifica alle candidature esistenti, nessun intervento su email o assegnazioni.
