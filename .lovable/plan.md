# Fattura elettronica completa al primo colpo

Nota: il testo incollato inizia con il segnaposto "[Incolla qui le regole del §10]", quindi le regole non sono arrivate. Applico le regole di lavoro già note (solo interventi additivi, SET search_path, nessun DROP, niente dati toccati, ogni punto non implementato dichiarato).

## 1. Migration additiva (solo ADD COLUMN)
```sql
ALTER TABLE public.impostazioni
  ADD COLUMN fic_ei_metodo_pagamento text NOT NULL DEFAULT 'MP05'
  CHECK (fic_ei_metodo_pagamento ~ '^MP[0-9]{2}$');
COMMENT ON COLUMN public.impostazioni.fic_ei_metodo_pagamento IS
  'Codice SDI ModalitaPagamento (MP01..MP23) per ei_data.payment_method della fattura elettronica';
```
Nessuna funzione nuova, nessuna policy toccata. In `FattureInCloudSection.tsx` una Select a elenco chiuso MP01–MP23 con descrizione italiana (es. MP05 Bonifico), letta e salvata insieme agli altri campi FIC.

## 2. ei_data (`_shared/fic-fattura.ts`)
`DatiFattura` riceve `eiMetodoPagamento: string` e `iban?: string | null`. Solo quando `scrittureLocaliAttive(tipo)` (cioè documento elettronico, lo stesso ramo di `e_invoice`): `ei_data = { payment_method, ...(iban ? { bank_iban: iban } : {}) }`. Nessuna chiave null/undefined. `payment_method.id` di primo livello invariato.

## 3. entity completa
`DatiFattura` perde `ficEntityId` e `nomeCliente`, acquista `entity: ClientePayloadFic` (tipo già esportato da `fic-anagrafica.ts`, import di solo tipo, il modulo resta puro) e `ficEntityId`. Payload: `entity: { id, ...entity }`.
In `fic-emetti-fattura/index.ts` `const mappatura = mappaAnagraficaPerFic(ana)` si sposta prima di `costruisciPayloadFattura` (oggi è calcolata dopo, alla riga del PUT): è puro calcolo, nessuna chiamata esterna in più nell'anteprima. Lo stesso oggetto `mappatura.data` va al PUT e al documento. Rimosso l'import di `nomeCompleto` se non più usato.

## 4. payment_terms
Nuova funzione pura `giorniFra(da, a)` (UTC). Ogni voce di `payments_list` include `payment_terms: { days: giorniFra(dataEmissione, due_date), type: 'standard' }`. `scadenzaDocumento` invariata: days mai negativo, 0 sugli arretrati.

## 5. Descrizione
`descrizioneCanone` -> `Canone di ospitalità Studentato Europa, marzo 2026`.

## 6. Log dopo POST riuscito
Nella riga `fic_log` di esito ok: `numeration`, `number`, `due_date`, `payment_terms`, `ei_payment_method`, `ei_bank_iban_presente` (sì/no), `entity_campi` = `campiValorizzati(entity)` sulla risposta. Nessun valore personale.

## Test (`src/test/fic-fattura.test.ts`)
- fixture con `entity` da `mappaAnagraficaPerFic`;
- ei_data presente solo in invoice, con e senza IBAN (senza `bank_iban`);
- entity completa per anagrafica italiana ed estera (CAP 00000, provincia EE, niente tax_code);
- payment_terms coerente con due_date, incluso arretrato con days = 0;
- nuova descrizione (aggiorna i casi esistenti);
- invariante ricorsiva: nessuna proprietà null/undefined, in proforma e invoice.
Rimossi i due casi basati su `nomeCliente` (sostituiti dai casi entity).

## Verifica
Typecheck, suite Vitest con esito riportato, build, deploy di `fic-emetti-fattura`, aggiornamento di `docs/Context.md` (voce payload FIC) e `roadmap.md`, confronto finale col piano.

## Dichiarato fuori perimetro
Nessuna emissione reale lanciata da me; nessuna modifica a fic-sync-anagrafica.
