## Modifiche etichette e opzioni form candidatura

### 1. `src/i18n/translations.ts` (IT + EN)
- **Ordine/pulizia** — domanda + opzioni:
  - IT: `ordinePulizia` → "Come ti comporti con ordine e pulizia?"; `ordineMolto` → "Rimetto tutto a posto subito"; `ordineAbbastanza` → "Rimetto a posto, ma non sempre subito"; rimuovere `ordineFlessibile`, aggiungere `ordinePoco` → "Tendo a lasciare le cose in giro".
  - EN: `ordinePulizia` → "How do you handle tidiness and cleaning?"; `ordineMolto` → "I put everything back right away"; `ordineAbbastanza` → "I tidy up, but not always straight away"; `ordinePoco` → "I tend to leave things lying around".
- **Fumatore**: IT `fumatore` → "Fumi?"; EN → "Do you smoke?".
- **Garante relazione**: IT `garanteRelazione` → "Che rapporto ha con te?"; EN → "What is their relationship to you?".
- **Tipo studente** (etichette, valori DB invariati). La versione EN deve coprire gli stessi insiemi della IT (triennale + magistrale nella prima; post-laurea + dottorato nella terza):
  - IT: `tipoStudente` → "Percorso di studi"; `tipoStudenteUniversitario` → "Corso di laurea"; `tipoStudenteErasmus` → "Erasmus o scambio"; `tipoStudenteMaster` → "Master o dottorato"; `tipoStudenteAltro` → "Altro".
  - EN: `tipoStudente` → "Study path"; `tipoStudenteUniversitario` → "Undergraduate or graduate degree"; `tipoStudenteErasmus` → "Erasmus or exchange"; `tipoStudenteMaster` → "Postgraduate course or PhD"; `tipoStudenteAltro` → "Other".
- **Privacy (punto 8)**: sostituire `dichPrivacy` con tre chiavi da comporre nel JSX:
  - `dichPrivacyBefore` IT "Dichiaro di aver preso visione dell'" / EN "I confirm I have read the ".
  - `dichPrivacyLink` IT "informativa privacy" / EN "privacy policy".
  - `dichPrivacyAfter` IT "." / EN "." (punto finale anche in inglese, per coerenza con le altre dichiarazioni).
  - Rimuovere `dichPrivacy`.

### 2. `src/lib/privacy.ts` (nuovo)
Costante condivisa `PRIVACY_POLICY_URL = 'https://studentatoeuropa.it/privacy-policy'`.

### 3. `src/pages/Candidatura.tsx` e `src/pages/CandidaturaCompleta.tsx`
- Aggiungere `SelectItem value="poco"` per ordine/pulizia con label `form.ordinePoco`. Rimuovere l'item `flessibile`.
- **Struttura riga privacy** — nessun link annidato in una `<label>`, e nessun tentativo di bloccare la propagazione (non affidabile: l'attivazione della label è comportamento nativo del browser, non intercettabile in React). Ristrutturare la riga come contenitore `div` (non `label`) con l'aspetto visivo attuale (border, padding, hover). Dentro:
  - `<Checkbox id="dich-privacy" ... />` con la propria area cliccabile.
  - `<label htmlFor="dich-privacy">` che avvolge SOLO il testo statico precedente/successivo al link e l'asterisco obbligatorio. Il link `<a>` sta FUORI da `<label>`, come sibling all'interno del contenitore.
  - Il link: `<a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">`.
  - Layout inline (`flex items-start gap-3`, testo in `<span className="text-[13px] leading-relaxed">` con i frammenti inline) per mantenere l'aspetto identico all'attuale.
- Le altre tre dichiarazioni restano `<label>` cliccabili come oggi.
- In `CandidaturaCompleta.tsx` estrarre `privacy` dal `.map()` e renderla con il markup speciale sopra; le altre tre restano nel map.
- Import `PRIVACY_POLICY_URL` dal modulo condiviso in entrambi i file.

### 4. `src/pages/admin/Candidature.tsx`
- `TIPO_STUDENTE_LABELS`: `universitario: 'Corso di laurea'`, `erasmus: 'Erasmus o scambio'`, `master: 'Master o dottorato'`, `altro: 'Altro'`.
- `PERSONALITA_LABELS`: `tranquilla: 'Persona tranquilla'`, `socievole: 'Persona socievole'`, `riservata: 'Persona riservata'`, `altro: 'Altro'`.
- `ORDINE_LABELS`: `molto: 'Rimette tutto a posto subito'`, `abbastanza: 'Rimette a posto, ma non sempre subito'`, `poco: 'Tende a lasciare le cose in giro'`. Rimuovere `flessibile`.

### 5. `supabase/functions/complete-candidatura/index.ts`
Aggiungere validazione whitelist per `ordine_pulizia`, allineata a quella di `orari`:
```ts
if (!["molto", "abbastanza", "poco"].includes(ordine_pulizia)) {
  return json({ error: "Valore ordine/pulizia non valido" }, 400);
}
```

### 6. Verifica chiavi i18n
Al termine, riferire eventuali chiavi usate nei form ma mancanti in IT o EN (attese: nessuna; verificare `ordinePoco`, `dichPrivacyBefore/Link/After` presenti in entrambe le lingue e `dichPrivacy` non più referenziato).

### Vincoli rispettati
- Nessuna migration DB. Valori salvati invariati.
- Nessuna modifica a logica form, obbligatorietà, sessioni o upload.

### Output finale
File modificati:
1. `src/i18n/translations.ts`
2. `src/lib/privacy.ts` (nuovo)
3. `src/pages/Candidatura.tsx`
4. `src/pages/CandidaturaCompleta.tsx`
5. `src/pages/admin/Candidature.tsx`
6. `supabase/functions/complete-candidatura/index.ts`

+ report chiavi di traduzione mancanti.
