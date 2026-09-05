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

## Fuori perimetro

Nessuna modifica al database, nessuna modifica alle candidature esistenti, nessun intervento su email o assegnazioni.
