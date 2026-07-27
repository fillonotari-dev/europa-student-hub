
## Obiettivo
Trasformare l'header admin in una barra funzionale con titolo di pagina e selettore struttura globale. Rimuovere intestazioni locali e istanze duplicate del filtro. Fissare il bug per cui il filtro non propaga il ricaricamento dati tra pagine.

## 1. Filtro struttura come contesto globale

`src/hooks/useStrutturaFilter.ts` diventa un vero React Context:
- Nuovo `StrutturaFilterProvider` che tiene stato + persistenza `localStorage` in un unico posto.
- Hook `useStrutturaFilter()` legge dal context. Tutte le pagine che lo usano condividono la stessa istanza: cambiare valore nella top bar aggiorna `strutturaId` in ogni consumer, e le `useQuery` che lo hanno in `queryKey` si rifetchano automaticamente.
- API pubblica invariata (`strutturaId`, `setStrutturaId`, `strutture`, `nomeSelezionato`, `isAll`) — nessuna pagina consumer va toccata a livello di logica dati.

Bug corretto: oggi ogni chiamata ad `useStrutturaFilter` inizializza un `useState` locale, quindi il valore in una pagina non è lo stesso oggetto reattivo dell'altra. Con il context, un solo `setStrutturaId` invalida tutte le query in tutte le pagine.

## 2. Top bar admin

`src/pages/admin/AdminLayout.tsx`:
- Avvolge il tree con `StrutturaFilterProvider` (dentro `SidebarProvider`).
- `<header>` diventa: `SidebarTrigger` a sinistra, titolo pagina al centro-sinistra, `StrutturaSelect` a destra.
- Altezza header invariata.

### Titolo pagina — mappa + override esplicito
Nuovo piccolo contesto `PageTitleContext` (nello stesso file layout o in `src/hooks/usePageTitle.ts`):
- Mappa statica `route → label` per le rotte fisse note:
  - `/admin` → "Home"
  - `/admin/candidature` → "Candidature"
  - `/admin/residenti` → "Residenti"
  - `/admin/camere` → "Camere"
  - `/admin/strutture` → "Strutture"
  - `/admin/storico/candidature` → "Storico · Candidature" (idem residenti/camere)
- Se il pathname corrente non è nella mappa (es. futura `/admin/candidature/:id`), il layout mostra il titolo fornito dalla pagina tramite hook `usePageTitle(label)`, che scrive in `PageTitleContext` con `useEffect` (e resetta all'unmount). Se nessuna pagina lo imposta, fallback vuoto (no crash, nessuna stringa segnaposto).
- Precedenza: override della pagina > mappa. Così le pagine di dettaglio che verranno potranno impostare un titolo dinamico (es. "Candidatura · Mario Rossi") senza toccare il layout.

## 3. Rimozione intestazioni locali e filtri duplicati

Per ogni pagina admin: rimosso il blocco `<h1>` + sottotitolo iniziale e ogni `<StrutturaSelect>` nella barra filtri.
- `src/pages/admin/Dashboard.tsx` — rimuove header locale e `StrutturaSelect` (mantiene tutta la logica query).
- `src/pages/admin/Candidature.tsx` — idem.
- `src/pages/admin/Camere.tsx` — idem.
- `src/pages/admin/Residenti.tsx` — idem.
- `src/pages/admin/Strutture.tsx` — rimuove il blocco titolo + descrizione; la pagina inizia direttamente con la griglia delle card, allineata alle altre. **Il filtro globale NON si applica**: la pagina elenca sempre tutte le sedi (attive e disattivate come oggi), altrimenti sarebbe impossibile modificare una sede diversa da quella selezionata in top bar. Il `StrutturaSelect` in top bar resta comunque visibile e continua a governare le altre pagine.
- `src/pages/admin/storico/StoricoLayout.tsx` e le tre sotto-pagine — rimossi header locali (icona `History` + titolo + descrizione); resta la `Tabs` di navigazione tra candidature/residenti/camere. Il titolo "Storico · Candidature/Residenti/Camere" arriva dalla mappa in top bar.

Le barre filtri residue (stato, ricerca, ecc.) restano identiche.

## 4. Dashboard — metrica "Posti liberi"

`src/pages/admin/Dashboard.tsx`: nell'array `metrics`, la card "Studenti registrati" viene rimossa. "Posti liberi" (`stats.postiLiberi`) è già presente. La riga passa da 4 a **3 card** (Candidature ricevute, In valutazione, Posti liberi). Nessuna nuova card aggiunta: l'assetto verrà rivisto nel prossimo intervento quando sparirà anche "In valutazione". La griglia resta `sm:grid-cols-2 lg:grid-cols-4` per non introdurre variazioni di layout premature (le tre card si distribuiranno naturalmente).

Il calcolo `postiLiberi = totalePosti − postiOccupati` è già in `stats`, filtrato per struttura selezionata: nessuna nuova query.

## 5. Design system doc

`docs/design-system.md`, sezione "8. Pattern di pagina admin":
- Rimosso il blocco `<h1>` + descrizione dallo scheletro standard.
- Nuovo pattern: la pagina inizia direttamente con la toolbar filtri (o il contenuto principale); titolo e selettore struttura vivono nella top bar globale.
- Aggiunta nota su `usePageTitle` per le pagine di dettaglio con rotte parametrizzate.
- Menzionato `StrutturaFilterProvider` come sorgente unica del filtro sede, con eccezione esplicita per la pagina Strutture (che gestisce le sedi stesse).

## File modificati (previsti)
- `src/hooks/useStrutturaFilter.ts`
- `src/hooks/usePageTitle.ts` (nuovo)
- `src/pages/admin/AdminLayout.tsx`
- `src/pages/admin/Dashboard.tsx`
- `src/pages/admin/Candidature.tsx`
- `src/pages/admin/Camere.tsx`
- `src/pages/admin/Residenti.tsx`
- `src/pages/admin/Strutture.tsx`
- `src/pages/admin/storico/StoricoLayout.tsx`
- `src/pages/admin/storico/StoricoCandidature.tsx`
- `src/pages/admin/storico/StoricoResidenti.tsx`
- `src/pages/admin/storico/StoricoCamere.tsx`
- `docs/design-system.md`

Nessuna modifica a DB, edge functions, stati o azioni. `StrutturaSelect` e componenti shadcn non toccati.
