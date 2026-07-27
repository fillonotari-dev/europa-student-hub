## Obiettivo
Allineare il form di completamento (`/candidatura/completa/:token`) al form pubblico di base e rendere obbligatori i campi utili alla valutazione e all'abbinamento in camera doppia. Le regole vanno replicate anche server-side.

## 1. `src/pages/CandidaturaCompleta.tsx`

**Struttura step**
- `ALL_STEPS` diventa `['stepLifestyle', 'stepGarante', 'stepDocAggiuntivi', 'stepDichiarazioni']`. Lo step `stepReview` e il componente `ReviewSection` vengono rimossi.
- Il pulsante finale "Invia candidatura" appare sullo step `stepDichiarazioni`. Come nel form base, resta disabilitato finché non sono spuntate tutte e quattro le dichiarazioni:
  ```
  const allDichiarazioniAccettate =
    dichiarazioni.veridicita && dichiarazioni.privacy &&
    dichiarazioni.info_struttura && dichiarazioni.contatto;
  ```
  applicato a `<Button disabled={submitting || !allDichiarazioniAccettate}>`.
- Le quattro checkbox delle dichiarazioni ricevono l'asterisco rosso, replicando lo stile del `DeclCheckbox` del form base (span `text-destructive` accanto al testo).

**Nuove regole di `validateStep`** (mantengono lo stesso schema toast già in uso):
- `stepLifestyle`: obbligatori `lingue_parlate`, `orari`, `personalita`, `ordine_pulizia`, `presentazione`; se `personalita === 'altro'`, obbligatorio anche `personalita_altro`. `fumatore` (Switch) resta libero. `orari` deve essere uno dei tre valori esistenti (`mattiniero` | `serale` | `variabile`).
- `stepGarante`: aggiunto obbligo di `garante_email` con la stessa regex email già usata nello step (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
- `stepDocAggiuntivi`: invariato (garante obbligatorio).
- `stepDichiarazioni`: la validazione dentro `validateStep` viene rimossa (irraggiungibile ora che è l'ultimo step); la garanzia reale è il pulsante disabilitato.

**Asterischi obbligatori** aggiunti alle Label di: `lingueParlate`, `orariPrevalenti`, `personalita` (e input `personalita_altro` quando visibile), `ordinePulizia`, `presentazione`, `garanteEmail`, e alle quattro dichiarazioni. Stile identico agli asterischi già presenti nel file (`<span className="text-destructive ml-0.5">*</span>`).

**Help text presentazione**: sotto la `<Textarea>` del campo `presentazione`, un `<p className="text-[12px] text-muted-foreground mt-1">` che mostra `t(lang, 'form.presentazioneHelp')`.

## 2. `src/i18n/translations.ts`

- Rimuovere le chiavi orfane usate solo dal riepilogo (verificare `stepReview` se non più referenziato).
- Rinominare solo le etichette (i valori DB restano `mattiniero`/`serale`/`variabile`):
  - IT `orariPrevalenti` → "Come sono di solito le tue giornate?"
  - IT `orariMattiniero` → "Mi sveglio presto e vado a letto presto"
  - IT `orariSerale` → "Faccio tardi la sera"
  - IT `orariVariabile` → "Dipende dai giorni"
  - EN equivalenti neutre: "How do your days usually go?" / "I wake up early and go to bed early" / "I stay up late" / "It depends on the day"
- Aggiungere `presentazioneHelp` IT/EN: suggerimento su provenienza, corso di studi, interessi.

## 3. `src/pages/admin/Candidature.tsx`

Nella mappa etichette (riga 66) sostituire con versioni neutre capitalizzate (coerenti con le altre mappe dello stesso file e con l'export Excel):
```
mattiniero: 'Si sveglia presto',
serale: 'Fa tardi la sera',
variabile: 'Dipende dai giorni',
```

## 4. `supabase/functions/complete-candidatura/index.ts`

Aggiungere validazione server-side (mantenendo limiti e stile messaggi generici già in uso):
- `lingue_parlate`, `orari`, `personalita`, `ordine_pulizia`, `presentazione`, `garante_email` diventano obbligatori (aggiunti ai controlli di presenza dopo le validazioni `optStr`).
- `orari` deve essere in `['mattiniero','serale','variabile']`.
- Se `personalita === 'altro'`, richiedere `personalita_altro` non vuoto.
- `garante_email` obbligatoria e già validata con `EMAIL_RE` esistente.
- Le dichiarazioni restano validate come oggi (già rifiuta se manca uno dei quattro flag).

## Vincoli rispettati
- Flusso token, sessione candidatura e upload documenti invariati.
- Documento garante obbligatorio, aggiuntivo facoltativo.
- Etichette IT + EN.
- Nessun colore hard-coded, nessuna riscrittura di componenti shadcn.

## File modificati (previsti)
- `src/pages/CandidaturaCompleta.tsx`
- `src/i18n/translations.ts`
- `src/pages/admin/Candidature.tsx`
- `supabase/functions/complete-candidatura/index.ts`
