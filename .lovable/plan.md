## Obiettivo
Permettere "Nessuna preferenza" sia per struttura che per tipo camera nel form pubblico di candidatura, allineando frontend e server.

## 1. `src/pages/Candidatura.tsx`
- Rimuovere `struttura_preferita_id` dall'elenco dei campi obbligatori in `requiredByKey` per `stepPreferences`.
- Aggiungere un `SelectItem` esplicito "Nessuna preferenza" (chiave i18n `nessuna`) sia nel menu **Struttura** sia nel menu **Tipo camera**.
- Usare il valore sentinella `__nessuna` (Radix Select non accetta `value=""`).
- Nel handler dell'invio (o al momento di costruire il payload), tradurre `__nessuna` → `null` per entrambi i campi prima di chiamare l'edge function.
- Verificare che lo stato iniziale/reset dei campi resti compatibile (il valore sentinella deve poter essere selezionato senza rompere la validazione degli altri step).

## 2. `supabase/functions/submit-candidatura/index.ts`
Sostituire il blocco:
```ts
if (typeof struttura_preferita_id !== "string" || !UUID_RE.test(struttura_preferita_id)) {
  return bad("Struttura preferita obbligatoria");
}
```
con una validazione opzionale:
- Se `struttura_preferita_id` è `undefined`, `null` o stringa vuota → salvare `null`.
- Se presente → deve essere una stringa che passa `UUID_RE`, altrimenti `bad("Struttura preferita non valida")`.
- Passare il valore normalizzato (uuid o `null`) nell'`insert` su `candidature`.

Nessuna migration necessaria: `candidature.struttura_preferita_id` è già nullable.

## 3. Deploy & verifica
- Deploy della edge function `submit-candidatura`.
- Test manuale: invio candidatura senza selezionare struttura né tipo camera → deve essere accettata e salvata con entrambi i campi a `null`.
- Test controllo: invio con struttura selezionata → continua a funzionare.

## Note tecniche
- Le chiavi i18n `nessuna` esistono già in IT/EN, non servono aggiunte a `src/i18n/translations.ts`.
- La conversione sentinella→null va fatta in un solo punto (submit handler) per evitare divergenze.
