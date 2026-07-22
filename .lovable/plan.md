## Obiettivo

Intercettare gli errori sulle date di permanenza già nello step "Dati accademici" e, quando l'invio finale fallisce comunque, mostrare il messaggio reale restituito dal server invece del generico "Edge Function returned a non-2xx status code".

## Modifiche

### 1. `src/pages/Candidatura.tsx` — `validateStep()` per `stepAcademic`

Dopo il controllo di presenza dei campi obbligatori, quando `stepKey === 'stepAcademic'`:

- verificare che `form.periodo_inizio` e `form.periodo_fine` siano date parseabili;
- verificare che `periodo_fine >= periodo_inizio`;
- opzionalmente segnalare se `periodo_inizio` è nel passato (solo warning testuale nel toast, non blocca — da confermare, vedi Domande).

In caso di violazione, mostrare un toast `destructive` con messaggio specifico (es. "La data di fine permanenza deve essere successiva alla data di inizio") e ritornare `false`, esattamente come per gli altri campi obbligatori dello stesso step. Aggiungere le nuove chiavi di traduzione IT/EN in `src/i18n/translations.ts` (es. `form.periodoFineBeforeInizio`).

### 2. `src/pages/Candidatura.tsx` — errore reale in `handleSubmit`

Sostituire l'attuale:

```ts
const { error } = await supabase.functions.invoke('submit-candidatura', { body: {...} });
if (error) throw error;
```

con il pattern già usato in `CandidaturaCompleta.tsx`: destrutturare anche `data`, e in caso di `error` leggere prima `data?.error` per il messaggio del server; gestire inoltre il caso in cui il body dell'errore non è disponibile in `data` (Supabase JS non lo popola sempre sui non-2xx) tentando `await error.context?.response?.json()` se presente. Fallback finale al messaggio generico tradotto.

```ts
const { data, error } = await supabase.functions.invoke('submit-candidatura', { body: {...} });
if (error) {
  let serverMsg: string | undefined = (data as any)?.error;
  if (!serverMsg) {
    try { serverMsg = (await (error as any).context?.response?.json())?.error; } catch {}
  }
  throw new Error(serverMsg || error.message || t(lang, 'form.submitError'));
}
if ((data as any)?.error) throw new Error((data as any).error);
```

Nessuna modifica alle Edge Functions: `submit-candidatura` già restituisce messaggi specifici come `"Periodo inizio non valido"` con status 400.

## Fuori scopo

- Nessuna modifica al backend o alle altre funzioni.
- Nessun refactor di `CandidaturaCompleta.tsx` (già corretto).

## Domande

1. Sulla data di inizio nel passato: bloccare l'utente o lasciar passare (magari con warning)? -> Bloccare l'utente 