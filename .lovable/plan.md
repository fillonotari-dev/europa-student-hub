# Aggiunta struttura "Pieve" — piano completo

## Quadro di partenza

La tabella `strutture` è già dinamica: `Camere`, `Candidatura`, `Residenti`, `ExportButton` leggono tutto da DB. L'unica struttura attuale è "Turri" (`a0000000-…-0001`). I punti hardcoded sono pochi e ben circoscritti. Il lavoro si divide in 3 aree: **dati**, **UI multi-struttura**, **rifiniture**.

---

## 1) Dati — Inserimenti DB

### 1a. Inserire la struttura

Nuova riga in `strutture`:

- `nome = 'Pieve'`
- `indirizzo = <da fornire>`
- `piani = <da fornire>`
- `attiva = true` (così appare subito nel form di candidatura pubblica)

### 1b. Inserire le camere iniziali

Per ogni camera: `numero`, `piano`, `tipo` (singola/doppia), `posti`, `stato = 'libera'`. Verranno seedate via insert tool, collegate alla nuova `struttura_id`.

### Info che mi servono da te prima di eseguire

1. **Indirizzo completo** della struttura Pieve.
2. **Numero di piani**.
3. **Elenco camere** (formato suggerito: una riga per camera con `numero | piano | tipo | posti | note opzionali`).

---

## 2) UI multi-struttura

### 2a. Selettore globale di struttura nella Dashboard admin

File: `src/pages/admin/Dashboard.tsx`

Cambiamenti:

- Aggiungere in cima un `Select` "Struttura: [Tutte | Turri | Pieve | …]" alimentato dalla query `strutture` (riuso del pattern già usato in `Camere.tsx`).
- Tutte le metriche calcolate (`totalePosti`, `postiOccupati`, `occupazione`, `recentCandidature`, task items) vanno filtrate per la struttura selezionata, oppure aggregate se "Tutte".
- Sostituire l'header hardcoded "Occupazione struttura Turri" con `Occupazione {nomeStrutturaSelezionata || 'totale'}`.
- Lo stato del selettore può essere persistito in `localStorage` per coerenza tra sessioni.

### 2b. Coerenza con altre pagine

- `Camere.tsx`: già ha il filtro per struttura ✓ — nessun cambio.
- `Residenti.tsx`: oggi non ha filtro per struttura; aggiungo lo stesso `Select` in cima per coerenza con Dashboard/Camere.
- `Candidature.tsx` (admin): la struttura preferita è già una colonna ordinabile; aggiungo filtro per struttura preferita.
- `Storico*` (Camere/Residenti): aggiungo lo stesso filtro per struttura.

---

## 3) Rifiniture testuali e di branding

I riferimenti a "Studentato Europa" come **brand** restano invariati (è il nome dell'azienda, non della struttura). Verifico che nessun copy confonda "Europa" con "Turri":

- `Index.tsx` riga 47: `Studentato Europa · Via Turri 69, Reggio Emilia` → cambio in `Studentato Europa · Reggio Emilia` (l'indirizzo specifico di una sola struttura non rappresenta più tutto).
- `Candidatura.tsx`, `Login.tsx`, `AdminSidebar.tsx`: brand "Studentato Europa" → invariati ✓.
- Subject email mailto in `Candidature.tsx` ("La tua candidatura - Studentato Europa") → invariato ✓.

---

## 4) Form pubblico di candidatura

Nessun cambiamento di codice necessario: `src/pages/Candidatura.tsx` legge `strutture` con `attiva = true` e popola il `Select` "Struttura preferita" dinamicamente. Pieve apparirà automaticamente.

---

## File toccati

- **DB (insert tool)**: nuove righe in `strutture` e `camere`.
- `src/pages/admin/Dashboard.tsx` — selettore + metriche filtrabili.
- `src/pages/admin/Residenti.tsx` — filtro struttura.
- `src/pages/admin/Candidature.tsx` — filtro struttura preferita.
- `src/pages/admin/storico/StoricoCamere.tsx`, `StoricoResidenti.tsx` — filtro struttura.
- `src/pages/Index.tsx` — copy footer.

## Cosa NON tocco (e perché)

- Schema DB / RLS: nessuna modifica strutturale necessaria, è già pronto al multi-struttura.
- Edge function `submit-candidatura`: già struttura-agnostica.
- `Camere.tsx` (admin): già ha tutto.
- Tipi `src/integrations/supabase/types.ts`: auto-generati.

---

## Domande aperte (rispondi prima dell'implementazione)

1. Indirizzo completo di Pieve?
2. Numero di piani?
3. Elenco camere (numero, piano, tipo singola/doppia, posti)?
4. Vuoi un'icona/etichetta visiva diversa per distinguere Pieve da Turri nelle liste, o basta il nome?

-> usare dei placeholder per le informazioni di Pieve perché ancora non abbiamo tutte le informazioni