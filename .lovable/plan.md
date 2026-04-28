# Selezione Università / Dipartimento / Corso di studi

Trasformare i campi accademici nel form di candidatura in tre menù collegati a cascata, basati sull'elenco UNIMORE fornito.

## Comportamento

**Step "Dati accademici"** diventa:

1. **Università** — combobox ricercabile (stile nazionalità). Per ora contiene un'unica voce: *Università di Modena e Reggio Emilia (UNIMORE)*. Pre-selezionata di default ma modificabile (struttura pronta per future aggiunte).
2. **Dipartimento** *(nuovo campo)* — combobox ricercabile, popolato in base all'università scelta. Disabilitato finché l'università non è selezionata.
3. **Corso di studi** — combobox ricercabile, popolato in base al dipartimento scelto. Mostra i corsi raggruppati per livello (Ciclo Unico / Triennali / Magistrali / Professioni Sanitarie). Disabilitato finché il dipartimento non è selezionato.
4. **Anno di corso** e **Matricola** restano invariati.

Cambiare università o dipartimento resetta i campi figli.

Tutti e tre i campi restano obbligatori. Le label sono tradotte (IT/EN), i nomi dei dipartimenti e dei corsi restano in italiano (sono nomi propri).

## File da creare

- **`src/lib/universities.ts`** — registro dati strutturato:
  ```ts
  type Course = { name: string; level: 'ciclo_unico' | 'triennale' | 'magistrale' | 'professione_sanitaria' };
  type Department = { name: string; sede: string; courses: Course[] };
  type University = { id: string; name: string; departments: Department[] };
  ```
  Popolato con UNIMORE e i 10 dipartimenti/facoltà del documento allegato (Economia Marco Biagi, Comunicazione ed Economia, Giurisprudenza, Educazione e Scienze Umane, Studi Linguistici e Culturali, Medicina e Chirurgia, Scienze della Vita, Scienze Chimiche e Geologiche, Scienze Fisiche Informatiche e Matematiche, Ingegneria Enzo Ferrari, Scienze e Metodi dell'Ingegneria) con tutti i corsi.

## File da modificare

- **`src/pages/Candidatura.tsx`**
  - Aggiungere `dipartimento` allo state `form`.
  - Sostituire i tre `Field` di università/corso con un nuovo componente `AcademicFields` che gestisce le tre combobox a cascata (riusando la stessa UI Popover+Command di `NationalityField`, eventualmente fattorizzata in un piccolo componente `Combobox` interno al file).
  - Aggiornare `validateStep` step 1: richiedere `universita`, `dipartimento`, `corso_di_studi`, `anno_di_corso`, `matricola`.
  - Aggiungere il dipartimento nella sezione di riepilogo (step 4).

- **`src/i18n/translations.ts`**
  - Nuova chiave `form.dipartimento` (IT: "Dipartimento", EN: "Department").
  - Placeholder per i combobox (es. "Seleziona università/dipartimento/corso").

## Note tecniche

- Il dipartimento **non viene salvato** nel database: la tabella `candidature` non ha una colonna dedicata e non si vuole introdurre una migrazione. Per conservare comunque l'informazione, il dipartimento verrà concatenato al campo `corso_snapshot` esistente nel formato `"<Nome corso> — <Nome dipartimento>"` lato edge function. *(Alternativa se preferisci: aggiungere colonna `dipartimento_snapshot` con migrazione — fammelo sapere.)*
- **`supabase/functions/submit-candidatura/index.ts`**: accettare il nuovo campo `dipartimento` nel body e comporre `corso_snapshot = "<corso> — <dipartimento>"`. Nessun'altra modifica al backend.

## Estendibilità

Aggiungere nuove università in futuro = aggiungere una voce all'array in `src/lib/universities.ts`. Nessuna modifica al form.
