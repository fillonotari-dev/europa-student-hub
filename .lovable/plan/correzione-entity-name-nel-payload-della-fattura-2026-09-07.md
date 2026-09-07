# Correzione: `entity.name` nel payload della fattura

Fatture in Cloud rifiuta il documento con 422 `"entity.name": ["The entity.name field must not be empty."]`: il payload manda solo `entity.id`, ma serve anche il nome. Il nome deve venire da `nomeCompleto` in `_shared/fic-anagrafica.ts`, la stessa funzione che alimenta la mappatura del cliente, così documento e anagrafica remota non possono divergere e il caso del soggetto giuridico è già gestito in un posto solo.

## Modifiche

1. **`supabase/functions/_shared/fic-fattura.ts`**
   - `DatiFattura` acquista il campo `nomeCliente: string`.
   - `costruisciPayloadFattura` emette `entity: { id: d.ficEntityId, name: d.nomeCliente }`.
   - Il modulo resta puro: nessun import da `fic-anagrafica.ts`, il nome arriva già composto dal chiamante (mantiene il modulo importabile dai test Vitest senza dipendenze).

2. **`supabase/functions/fic-emetti-fattura/index.ts`**
   - Importa `nomeCompleto` da `_shared/fic-anagrafica.ts`.
   - Al punto di costruzione del payload passa `nomeCliente: nomeCompleto(ana)` (l'anagrafica è già caricata per la guardia (c)).

3. **`src/test/fic-fattura.test.ts`**
   - Aggiorna il fixture `base` con `nomeCliente`.
   - Nuovo caso: `entity.name` valorizzato per una persona fisica (`nomeCompleto({ nome, cognome })`).
   - Nuovo caso: `entity.name` valorizzato per un soggetto giuridico (`nomeCompleto({ tipo: 'soggetto_giuridico', denominazione })`), verificando che il nome sia la denominazione e non nome+cognome.

## Verifica

Typecheck, suite Vitest completa, build. Deploy della funzione `fic-emetti-fattura` (il comportamento cambia anche in modalità anteprima e proforma).
