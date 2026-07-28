Piano B v2 approvato con quattro correzioni. Riporto la versione finale che verrà implementata (già discussa e concordata).

## Verifiche fatte

- **Form pubblico** (`Candidatura.tsx` r.49–61): i sei campi indirizzo, `cf_non_disponibile` e la checkbox "non ho CF" ci sono già. Non c'è più `indirizzo_residenza` unico.
- **Insert `studenti`** (submit-candidatura r.199–210, ramo nuovo studente): scrive già i sei campi indirizzo + `cf_non_disponibile`. Ramo `existingStudent`: non tocca nulla di anagrafico (commento esplicito su prevenzione takeover).
- **Tetti file**: client `MAX_UPLOAD_BYTES = 5 MB`, server `MAX_BYTES = 5 MB`, messaggio "max 5 MB". Coincidono. Da mantenere.
- **Build config** (`tsconfig.app.json`, `vite.config.ts`): `include` solo `src`, alias solo `@/*`. Vanno estesi per la sorgente unica.

## 1. Configurazione build (sorgente unica in `_shared`)

- `tsconfig.app.json`: aggiungere `"@shared/*": ["../supabase/functions/_shared/*"]` in `paths` e `"supabase/functions/_shared"` in `include`.
- `vite.config.ts`: aggiungere alias `"@shared": path.resolve(__dirname, "./supabase/functions/_shared")`.
- Se questo non basta e la build fallisce, **fermarsi e segnalarlo**. Non duplicare.

## 2. Moduli condivisi (`supabase/functions/_shared/`)

- **`codice-fiscale.ts`** — `validateCodiceFiscale(input): { ok, normalized }`. Normalizza a maiuscolo, pattern `^[A-Z0-9]{16}$`, gestione omocodia (posizioni 0-indexed 6,7,9,10,12,13,14 con mappa `L→0…V→9`), carattere di controllo con tabelle standard dispari/pari, `sum % 26 → A..Z`.
- **`province.ts`** — 110 sigle italiane + nomi. `SIGLE_PROVINCE_SET`.
- **`countries.ts`** — ISO-3166 alpha-2 (nome IT/EN). `COUNTRY_CODE_SET`.

Import lato Deno: `../_shared/codice-fiscale.ts`. Import lato frontend: `@shared/codice-fiscale`.

## 3. Frontend

- **`DateOfBirthPicker.tsx`** (nuovo): tre `Select` (giorno / mese esteso / anno). Anni `currentYear-16 → 1900` decrescenti. Giorni ricomputati con `new Date(year, month, 0).getDate()`; giorno non valido → azzerato, valore `''`. Emette `YYYY-MM-DD` o `''`.
- **`imageResize.ts`** (nuovo): `resizeImageIfNeeded(file)`. Tenta il decode su qualunque `image/*` (HEIC incluso su Safari), disegna su canvas con lato max 2000 px, esporta JPEG q=0.8, restituisce nuovo `File .jpg`. Se il decode fallisce lancia `IMAGE_DECODE_FAILED`. PDF passano invariati.

## 4. `Candidatura.tsx`

- Rimuovere `anno_di_corso` dallo state e dallo step accademico.
- `data_nascita` → `<DateOfBirthPicker />`.
- CF: valida in `validateStep` con `validateCodiceFiscale` se `!cf_non_disponibile`.
- Provincia → `<Select>` da `PROVINCE` (sigla), visibile/obbligatoria solo se `nazione === 'IT'`.
- Nazione → `<Combobox>` esistente su `COUNTRIES` (alpha-2), default `IT`.
- CAP: `^\d{5}$` solo se `IT`; altrimenti 1–20 caratteri.
- Struttura preferita → obbligatoria (aggiunta a `requiredByKey.stepPreferences`; nel payload rimuovere solo il fallback `|| null`, il campo continua a essere inviato).
- `periodo_inizio` / `periodo_fine` / `data_arrivo_prevista`: `min={today}` e `max={today+2y}` sugli input date.
- `handleFile` diventa async: chiama `resizeImageIfNeeded` **prima** di `ACCEPTED_TYPES`/size check. Errore decode → toast specifico. File salvato in `files` è quello processato; il nome mostrato è quello originale via `fileDisplayNames`.
- Etichette dei sei campi indirizzo: spostate da ternari inline JSX a `translations.ts` (`form.addressVia`, `_civico`, `_cap`, `_comune`, `_provincia`, `_nazione`).

## 5. `CandidaturaCompleta.tsx`

- `handleFile` async con `resizeImageIfNeeded` prima dei check, stesso pattern `fileDisplayNames`.
- **Nessun** campo anagrafica/CF/indirizzo aggiunto. Correzione dati dalla scheda persona in intervento successivo.

## 6. `submit-candidatura/index.ts`

Validazioni aggiunte:
- **`data_nascita`**: obbligatoria, `DATE_RE`, `>= 1900-01-01` e `<= today - 16y`.
- **`periodo_inizio` e `periodo_fine`**: **OBBLIGATORI**, entrambi `>= today` e `<= today + 2y`, `periodo_fine > periodo_inizio`.
- **`data_arrivo_prevista`**: facoltativa; se presente, `today ≤ x ≤ today+2y`.
- **`struttura_preferita_id`**: obbligatorio, UUID.
- **Anagrafica residenza**: `indirizzo_via`, `_civico`, `_cap`, `_comune`, `_nazione` **obbligatori**; `_provincia` obbligatorio solo se `_nazione === 'IT'`. Chiude il buco per cui il client protegge ma il server no.
- **CAP**: se `IT` → `^\d{5}$`; altrimenti 1–20.
- **Provincia**: se `IT` → `SIGLE_PROVINCE_SET.has(...)`.
- **Nazione**: `COUNTRY_CODE_SET.has(...)`; default `'IT'`.
- **CF**: se `!cf_non_disponibile` → `validateCodiceFiscale(...).ok`.
- **`anno_accademico`**: calcolato server-side da `periodo_inizio`. `startYear = mese>=9 ? anno : anno-1`. `mese>=9` significa settembre incluso; agosto (mese 8) e precedenti ricadono nell'anno precedente.

Ramo `existingStudent`: comportamento invariato, commento aggiornato citando indirizzo e CF come PII.

`anno_di_corso`: smettere di leggere/scrivere `anno_di_corso` in `studenti` e `anno_corso_snapshot` in `candidature`. Colonne lasciate in schema.

## 7. Traduzioni

Aggiunte IT/EN in `translations.ts`:
- `form.monthsFull` (array 12), `form.dobDay/Month/Year`.
- `form.invalidCf`, `form.strutturaRichiesta`, `form.periodoTooFar`.
- `form.cfNonDisponibile` (sostituisce letterale inline).
- `form.fileImageDecodeFailed`.
- `form.addressVia`, `form.addressCivico`, `form.addressCap`, `form.addressComune`, `form.addressProvincia`, `form.addressNazione`.

Rimosso: `form.annoCorso` (IT + EN).

## 8. Verifiche a lavoro completato

- Chiamata diretta a `submit-candidatura` con `data_nascita = 1899-05-01` → 400.
- `periodo_fine < periodo_inizio` → 400.
- Senza `periodo_inizio` → 400.
- Senza `struttura_preferita_id` → 400.
- Senza `indirizzo_via` (o `_civico`, `_comune`) → 400.
- `periodo_inizio = 2026-09-15` → `anno_accademico = "2026/2027"`.
- `periodo_inizio = 2027-03-10` → `"2026/2027"`.
- **Confine settembre**: `2026-08-31` → `"2025/2026"`; `2026-09-01` → `"2026/2027"`.
- CF valido → accettato; stesso CF con ultimo char alterato → rifiutato.
- CF vuoto + `cf_non_disponibile = true` → accettato.
- **CF con omocodia**: se riesco a procurarmi un vettore di riferimento indipendente (docs CF italiano / vettori DM 23/12/1976), lo uso; **altrimenti dichiaro il test non eseguito e non lo sostituisco con un caso circolare**.
- CAP `4321` con `IT` → 400; stesso CAP con `US` → passa.
- Foto JPEG ~5 MB selezionata → dopo `handleFile`, file inviato è JPEG < 1 MB, nome mostrato è l'originale.
- Foto HEIC su desktop senza supporto → toast specifico "formato non supportato".
- Scenario "studente esistente": creare studente con indirizzo A + CF valido, rifiutare candidatura, inviare seconda candidatura con stessa email + indirizzo B + CF diverso → verifica `read_query` che `studenti` mantiene indirizzo A e CF originale.
- Rilettura finale: `MAX_UPLOAD_BYTES`, `MAX_BYTES` e messaggio errore restano allineati a 5 MB.

## Fuori scope

- Nessuna migration.
- Nessuna modifica anagrafica in `complete-candidatura`.
- Nessuna correzione dati storici o UI di editing.
