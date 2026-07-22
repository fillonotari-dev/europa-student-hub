## Contesto

Nello step "Dichiarazioni" (`src/pages/Candidatura.tsx`) esistono già 4 checkbox (`veridicita`, `privacy`, `info_struttura`, `contatto`) tutte validate come obbligatorie lato client e server. Mancano però due cose:

1. Il bottone "Invia candidatura" resta cliccabile anche senza flag: viene bloccato solo dopo il click via `handleValidate`, restituendo un toast di errore.
2. Le label non segnalano visivamente l'obbligatorietà.

## Modifica

**File:** `src/pages/Candidatura.tsx`

- Calcolare `const allDichiarazioniAccettate = dichiarazioni.veridicita && dichiarazioni.privacy && dichiarazioni.info_struttura && dichiarazioni.contatto;`
- Sul bottone "Invia" (riga ~577), estendere `disabled` a `submitting || (stepKey === 'stepDichiarazioni' && !allDichiarazioniAccettate)`.
- Nel componente `DeclCheckbox` (o inline nelle 4 istanze) aggiungere l'asterisco rosso `*` accanto alla label per marcare visivamente l'obbligatorietà, coerente con gli altri campi required del form.

Nessuna modifica alla validazione backend o al payload: sono già gestiti.
