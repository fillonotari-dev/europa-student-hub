# Fatturazione: stati leggibili, due tab, archivio paginato, mese proposto

Stato attuale verificato:
- `Fatturazione.tsx:265-267`: `daRiconciliare` prende solo `in_invio` ed `emessa` senza mensilità collegata. Le due fatture in errore (9663ea09, 3c1a1922) esistono nel database ma la pagina non le mostra da nessuna parte.
- `Fatturazione.tsx:230-240`: `['fatturazione-fatture']` legge tutte le fatture senza limite. `:491` usa un Collapsible; `:32-37` `mesePredefinito` usa `getUTC*`.
- `src/components/ui/tabs.tsx` esiste. I token `success` e `warning` sono definiti in `index.css:33-37` e in `tailwind.config.ts:37-43`.

## 1. `src/lib/statiFatturazione.ts` (nuovo, modulo puro)
- `STATO_FATTURA`, solo token semantici:
  - in_invio → «In creazione», `bg-warning/15 text-warning-foreground`
  - emessa → «Creata su Fatture in Cloud», `bg-muted text-foreground` (neutro)
  - errore → «Errore», `bg-destructive/10 text-destructive`
- `STATO_CANONE`:
  - da_fatturare → «Da fatturare» (neutro)
  - fatturato → «Fatturata» (primary)
  - incassato → «Pagata» (success)
  - annullato → «Annullata» (muted)
- Ogni voce ha etichetta e classi. Per un valore sconosciuto c'è un ripiego che mostra il valore grezzo.
- Componente `StatoBadge` a livello di modulo, in `src/components/admin/fatturazione/StatoBadge.tsx`.
- Dove si usa: pannello «Da riconciliare», archivio (nuova colonna Stato), scadenzario di `ContrattoPage.tsx` (badge accanto a numero e data, dalla query `['fatture', id]` che legge già `stato`).
- I valori nel database non cambiano.

## 2. Due tab
- `Tabs`: «Fatturazione» e «Archivio (N)», con N = conteggio esatto.
- La vista vive nell'URL come `?vista=archivio`, tramite `patchParams`. Il default è la vista Fatturazione, senza parametro.
- Tab Fatturazione: selettore del mese, riquadro informativo, avviso arretrati, «Da riconciliare» (resta qui, è un presidio), tabella del mese.
- Eliminati `Collapsible` e `archivioOpen`.
- Il pattern Tabs viene documentato in `docs/design-system.md`.

## 3. Tab Archivio
- Colonne: Studente, Competenza, Numero con sezionale, Data, Totale, Stato (badge), Invio elettronico (`ei_status` grezzo).
- Il numero diventa un link in una nuova scheda quando `url_documento` è valorizzato.
- Paginazione lato server: query `['fatturazione-archivio', pagina, meseFiltro]` con `.range()` e `count: 'exact'`, 15 per pagina come in Candidature. Contatore «1–15 di N» e frecce precedente/successiva.
- Filtro per mese di competenza: si fa con un join interno sui canoni (`canoni!inner(competenza)`) filtrato sul mese. Senza filtro si usa un join sinistro, così compaiono anche le fatture senza mensilità.
- La query senza limite viene sostituita da query mirate:
  - per «Da riconciliare»: solo `stato in (in_invio, errore)`, più le `emessa` senza canone collegato;
  - per il conteggio dell'archivio: `head: true`.

## 4. Bug: le fatture in errore
- `daRiconciliare` include `stato = 'errore'`. Il pannello mostra il badge e il `messaggio_errore` registrato.
- Il resoconto conferma, leggendo il codice, che le due righe passano il filtro. Le verifico anche nel browser.

## 5. Mese proposto e stato vuoto
- `mesePredefinito(oggi, piuVecchioDaFatturare)` diventa una funzione pura in `src/lib/statiFatturazione.ts` (o in un modulo `meseFatturazione.ts`), con test.
- Regola: il più vecchio tra il mese precedente a `oggiRoma()` e il mese più vecchio con mensilità `da_fatturare` di contratti attivi. Non propone mai il mese corrente.
- Si applica solo quando il mese non è nell'URL, e dopo il caricamento degli arretrati.
- Stato vuoto:
  - «Settembre 2026 completato: N mensilità fatturate», con l'elenco in sola lettura e il badge `STATO_CANONE`;
  - oppure «Nessuna mensilità in questo mese».
- Sotto, quando esiste: «Prossimo lotto: <mese>, N mensilità, da fatturare dal 1° <mese successivo> → Vai».
- `docs/Context.md` aggiornato alle righe ~131 e ~367.

## 6. Righe del mese
- «Collega fattura esistente» passa nel menu ⋯ (`RowActions`) su ogni riga da fatturare.
- Colonna Stato con badge:
  - «Controllo…» (attesa)
  - «Pronta» (neutro)
  - messaggio della guardia (destructive)
- Il badge «mese parziale» resta accanto al nome.

## Verifica
- Test (`mesePredefinito`: mese precedente, arretrato più vecchio, gennaio → dicembre, mai il mese corrente; mappe di stato complete), controllo dei tipi, build.
- Prova nel browser: tab e URL, archivio paginato e filtrato, le due righe in errore visibili, stato vuoto e «Prossimo lotto», menu ⋯.
- Nel resoconto: file e riga di ogni modifica, scostamenti dichiarati.
- Nessuna migration, nessun dato modificato.
