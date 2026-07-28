## Diagnosi

Sulla scheda persona (`src/pages/admin/StudentePage.tsx`) la query documenti carica correttamente tutto (verificato a DB: lo studente in questione ha 2 righe in `public.documenti`, un `documento_identita` e un `certificato_iscrizione`).

Ma il render filtra solo due tipi:

```ts
const docIdentita = documenti.filter(d => d.tipo === 'documento_identita');
const docGarante  = documenti.filter(d => d.tipo === 'documento_garante');
```

I tipi `certificato_iscrizione` e `documento_aggiuntivo` (definiti in `supabase/functions/_shared/documenti-tipi.ts`) non vengono mai mostrati → nell'UI compare solo il documento d'identità.

## Fix

In `StudentePage.tsx`:

1. Calcolare anche `docAltri = documenti.filter(d => d.tipo !== 'documento_identita' && d.tipo !== 'documento_garante')` (così qualunque tipo futuro non venga più dimenticato).
2. Aggiungere una nuova sezione "Altri documenti" a piena larghezza — mostrata solo se `docAltri.length > 0` — con etichetta leggibile per tipo (`certificato_iscrizione` → "Certificato di iscrizione", `documento_aggiuntivo` → "Documento aggiuntivo") e le righe rese con `DocumentoRow` (che già gestisce apri/scarica via signed URL).
3. Posizione: subito dopo la sezione "Informazioni personali", prima della griglia 2×2 dati accademici/preferenze/…, così i documenti restano vicini all'anagrafica.

Nessuna modifica a schema, RLS o Edge Functions.
