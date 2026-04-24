## Piano: rimuovere "Esportazione" e aggiungere pulsante export per ogni pagina

### 1. Rimozione sezione Esportazione

- `src/components/admin/AdminSidebar.tsx`: rimuovo la voce "Esportazione" e l'import `Download` se non più usato (sarà riusato dal pulsante export, ma è importato solo qui).
- `src/App.tsx`: rimuovo l'import `Esportazione` e la rotta `<Route path="esportazione" .../>`.
- `src/pages/admin/Esportazione.tsx`: elimino il file.

### 2. Helper riutilizzabile per export

Nuovo file `src/lib/exportXlsx.ts` con una funzione generica:

```ts
exportToXlsx(filename: string, rows: Record<string, any>[]): void
```

Usa `xlsx` + `file-saver` (già nelle dipendenze, vedi `Esportazione.tsx`). Aggiunge automaticamente la data al nome file (`nome_YYYY-MM-DD.xlsx`).

### 3. Componente UI riutilizzabile

Nuovo file `src/components/admin/ExportButton.tsx`:
- Pulsante `<Button variant="outline" size="sm">` con icona `Download` e label "Esporta Excel".
- Props: `filename: string`, `getRows: () => Record<string,any>[]`, `disabled?: boolean`.
- Mostra toast di successo/errore tramite `useToast`.

### 4. Pulsante export nelle pagine

In ogni pagina aggiungo il pulsante in alto a destra, allineato al titolo (o accanto a "+ Nuova" dove esiste). **Esporta i dati attualmente filtrati/visibili**, non l'intero dataset, così l'admin può esportare un sottoinsieme mirato.

Pagine "normali":
- **`src/pages/admin/Candidature.tsx`** — colonne: Nome, Cognome, Email, Telefono, Università, Corso, Stato, Anno accademico, Periodo inizio/fine, Data candidatura.
- **`src/pages/admin/Residenti.tsx`** — colonne: Studente, Email, Struttura, Camera, Posto, Data inizio, Data fine, Stato.
- **`src/pages/admin/Camere.tsx`** — colonne: Struttura, Numero, Piano, Tipo, Posti, Stato.

Pagine "Storico":
- **`StoricoCandidature.tsx`** — colonne: Data, Studente, Email, Stato precedente, Stato nuovo, Note.
- **`StoricoResidenti.tsx`** — colonne: Studente, Email, Struttura, Camera, Posto, Data inizio, Data fine, Durata (giorni), Stato, Note.
- **`StoricoCamere.tsx`** — colonne: Struttura, Camera, Piano, Tipo, Assegnazioni totali, Assegnazioni attive. (La timeline per singola camera resta consultabile in dialog; l'export lista la vista corrente.)

### Dettagli tecnici

- L'helper mantiene la stessa logica già presente in `Esportazione.tsx` (XLSX.utils.json_to_sheet → workbook → blob → saveAs), centralizzata.
- I dati esportati vengono ricavati dall'array già caricato dalla query (`filtered` nelle pagine storico, equivalente nelle altre): nessuna nuova chiamata a Supabase.
- Le date vengono formattate `it-IT` come stringhe leggibili nell'xlsx.

### File toccati

1. `src/lib/exportXlsx.ts` *(nuovo)*
2. `src/components/admin/ExportButton.tsx` *(nuovo)*
3. `src/components/admin/AdminSidebar.tsx` — rimossa voce Esportazione
4. `src/App.tsx` — rimossi import e rotta
5. `src/pages/admin/Esportazione.tsx` — eliminato
6. `src/pages/admin/Candidature.tsx` — aggiunto ExportButton
7. `src/pages/admin/Residenti.tsx` — aggiunto ExportButton
8. `src/pages/admin/Camere.tsx` — aggiunto ExportButton
9. `src/pages/admin/storico/StoricoCandidature.tsx` — aggiunto ExportButton
10. `src/pages/admin/storico/StoricoResidenti.tsx` — aggiunto ExportButton
11. `src/pages/admin/storico/StoricoCamere.tsx` — aggiunto ExportButton

Nessuna modifica a DB o auth.