# Piano: sezione "Strutture" in area admin

## Obiettivo
Dare all'admin una sezione dedicata per **vedere** le strutture ricettive (Turri, Pieve e future) e **modificare** le loro informazioni anagrafiche, con metriche aggregate sulle camere.

## Stato attuale
- Tabella `strutture` già presente (campi: `nome`, `indirizzo`, `piani`, `attiva`, `created_at`, `updated_at`).
- Due strutture esistenti:
  - **Turri** — Via Turri 69, Reggio Emilia — 4 piani — 29 camere (tutte doppie, 58 posti)
  - **Pieve** — "Da definire" — 1 piano — 0 camere
- RLS già configurata: admin ha accesso completo, anonimi solo lettura.
- Le strutture vengono già usate in: filtro globale (`useStrutturaFilter`), candidatura pubblica, gestione camere.

## Ha senso permettere la modifica?
**Sì**, ma in modo controllato. Motivazioni:
- Pieve ha indirizzo placeholder ("Da definire") che va aggiornato senza dover passare da una migrazione.
- I `piani` di Pieve sono provvisori (1) e potrebbero cambiare quando si definisce la planimetria reale.
- Permette in futuro di aggiungere nuove strutture o disattivarne una senza intervento tecnico.

**Limitazioni consigliate** (per evitare incidenti):
- Nessuna eliminazione hard: si può solo **disattivare** (`attiva = false`). Una struttura disattivata sparisce dai filtri e dalla candidatura pubblica ma resta per lo storico.
- Nessuna creazione di nuove strutture nella prima iterazione (solo edit di quelle esistenti). Si può aggiungere dopo se serve.
- Il campo `nome` è modificabile ma con un avviso (compare in candidatura pubblica e storico).

## Cosa costruire

### 1. Voce sidebar "Strutture"
Aggiungere in `AdminSidebar.tsx` tra "Camere" e "Storico":
- Icona `Building2` (lucide), label "Strutture", url `/admin/strutture`.

### 2. Pagina elenco `/admin/strutture`
Lista a card (una per struttura), in stile coerente con Dashboard. Per ciascuna struttura mostra:
- Nome (es. "Turri")
- Indirizzo
- Numero di piani
- Badge stato: "Attiva" / "Disattivata"
- Metriche aggregate live da DB: numero camere totali, posti totali, posti occupati, camere singole/doppie
- Bottone "Modifica" che apre un dialog

### 3. Dialog di modifica
Form con i campi:
- **Nome** (text, obbligatorio) — con piccolo warning "Modificare il nome cambia anche come appare nel form pubblico di candidatura"
- **Indirizzo** (text)
- **Piani** (number, ≥ 1)
- **Attiva** (switch) — con conferma se si sta disattivando una struttura che ha camere occupate o candidature pendenti

Salvataggio via `update` su `strutture`, invalidazione query (`strutture-filter`, `strutture-list`, eventuali metriche dashboard).

### 4. Pagina dettaglio (opzionale, stessa rotta con tab interno)
Cliccando su una card si apre `/admin/strutture/:id` con:
- Header con nome + bottone Modifica
- Sezione "Anagrafica" (campi sopra in sola lettura)
- Sezione "Camere" — tabella ridotta delle camere di quella struttura, con link alla pagina Camere filtrata
- Sezione "Residenti attivi" — conteggio + link a Residenti filtrati

Nella prima iterazione **possiamo limitarci alla lista con dialog di modifica** (più semplice, copre il bisogno principale). La pagina dettaglio si può aggiungere dopo se utile.

## Dettagli tecnici

- Nuova rotta in `src/App.tsx`: `<Route path="strutture" element={<Strutture />} />` dentro `AdminLayout`.
- Nuovo file `src/pages/admin/Strutture.tsx` — pagina con `useQuery(['strutture-list'])` che fetcha tutte le strutture (anche non attive) e in parallelo aggrega `camere` e `assegnazioni` per le metriche.
- Mutation `useMutation` per update con `supabase.from('strutture').update(...).eq('id', ...)`.
- `AdminSidebar.tsx` — aggiungere voce nell'array `items`.
- Nessuna modifica DB necessaria (schema già adatto). Nessuna nuova policy RLS necessaria.
- Riutilizzare componenti esistenti: `Card`, `Dialog`, `Switch`, `Input`, `Label`, `Badge`, `Button`.

## Cosa NON facciamo (per ora)
- Creazione di nuove strutture dall'UI
- Eliminazione hard
- Upload di foto/planimetrie
- Gestione contatti/responsabili struttura

Se vuoi includere uno di questi punti, dimmelo e li aggiungo al piano.

## Domanda aperta
Vuoi che includa anche la **pagina di dettaglio** `/admin/strutture/:id` (punto 4) in questa iterazione, o partiamo solo con elenco + dialog di modifica?
