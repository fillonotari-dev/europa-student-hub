# Pagina introduttiva + stepper a pallini

## 1. Nuova pagina introduttiva (step 0)

All'apertura di `/candidatura` mostriamo una schermata informativa **prima** del form, senza chiedere alcun dato. L'utente legge e clicca "Inizia la candidatura" per accedere al primo step.

Contenuto in IT/EN, strutturato in 3 blocchi con icona + titolo + breve descrizione:

- **Quali dati raccogliamo** — dati anagrafici, accademici, preferenze sulla stanza, documento d'identità e certificato di iscrizione.
- **Perché ci servono** — per valutare la candidatura, assegnare la stanza più adatta e poterti ricontattare.
- **Tempi di risposta** — riceverai un riscontro entro X giorni lavorativi via email (testo configurabile come costante).

In fondo: pulsante primario "Inizia la candidatura" + nota privacy breve.

Implementazione: in `src/pages/Candidatura.tsx` aggiungiamo uno stato `started` (default `false`). Se `!started && !success`, mostriamo `<IntroScreen onStart={() => setStarted(true)} />`. Lo stepper a pallini non appare in questa schermata. Aggiungiamo le stringhe relative a `src/i18n/translations.ts` (intro title, lead, 3 blocchi, CTA, tempi).

## 2. Stepper a pallini animati

Sostituiamo il blocco "Step indicator" (Candidatura.tsx ~righe 341–353) con un componente di pallini ispirato alla reference:

- Una riga di N cerchi piccoli (uno per step), uniti da linee sottili.
- Stato:
  - **completato**: cerchio pieno colore `primary`
  - **corrente**: cerchio con anello/alone colore `primary` (effetto "acceso")
  - **futuro**: cerchio vuoto `border` su `muted`
- Linea di connessione fra pallini: si riempie progressivamente fino allo step corrente (transizione con `framer-motion`).
- **Senza etichette di testo** sotto i pallini (come da reference).
- Sopra/accanto allo stepper manteniamo solo il titolo del passo corrente (es. "Dati anagrafici") + sottotitolo opzionale, per non perdere il contesto ora che i nomi sotto i pallini spariscono.

Lo stesso componente viene applicato anche in `src/pages/CandidaturaCompleta.tsx` per coerenza visiva.

## 3. Dettagli tecnici

- Nuovo componente `src/components/candidatura/StepDots.tsx` (props: `total`, `current`).
- Animazioni con `framer-motion` (`layout`, `transition` `spring`).
- Colori: solo token semantici (`primary`, `border`, `muted`, `muted-foreground`).
- Nessuna modifica al backend, alle edge function o alle migrazioni.
- I dati raccolti elencati nella intro restano descrittivi (testo statico) — non leggiamo i campi custom dinamici per non complicare il copy.

## File toccati
- `src/pages/Candidatura.tsx` — intro screen + nuovo stepper + titolo step
- `src/pages/CandidaturaCompleta.tsx` — sostituzione stepper
- `src/components/candidatura/StepDots.tsx` — nuovo
- `src/i18n/translations.ts` — nuove chiavi intro
