## Obiettivo

1. Unificare il filtro struttura di **Camere** con quello condiviso (`useStrutturaFilter`) già usato da Dashboard, Residenti, Candidature e Storico.
2. Rendere la metrica **"Studenti registrati"** della Dashboard coerente con l'occupazione reale (assegnazioni attive) quando è selezionata una struttura specifica.

Nessuna migration, solo frontend.

## Modifiche

### `src/pages/admin/Camere.tsx`
- Rimuovere `useState('tutti')` locale per `selectedStruttura` e la query duplicata `['strutture']`.
- Importare `useStrutturaFilter` e `StrutturaSelect`.
- Sostituire lo state locale con:
  ```ts
  const { strutturaId, setStrutturaId, strutture, isAll } = useStrutturaFilter();
  ```
- Aggiornare la query `['camere', strutturaId]` usando `isAll` invece di `!== 'tutti'`.
- Sostituire il `<Select>` custom con:
  ```tsx
  <StrutturaSelect
    value={strutturaId}
    onChange={(v) => { setStrutturaId(v); setPage(1); }}
    strutture={strutture}
  />
  ```
- Il pre-select in `openCreate` (`strutture?.[0]?.id`) resta valido: `useStrutturaFilter` espone solo le strutture attive, comportamento corretto per la creazione camere.

### `src/pages/admin/Dashboard.tsx`
- Estendere la query esistente delle assegnazioni attive (quella già filtrata su `cameraIds` quando `!isAll`) per selezionare anche `studente_id`, non solo il conteggio.
- Da quella singola query derivare:
  - `postiOccupati` = numero di righe (identico ad oggi).
  - Quando `!isAll`, **"Studenti registrati"** = numero di `studente_id` distinti (dedup via `Set`).
  - Quando `isAll`, `totaleStudenti` resta il count totale su `studenti` (comportamento attuale).
- Nessuna chiamata extra al DB.

## Note tecniche
- L'appartenenza di uno studente a una struttura viene calcolata coerentemente in tutta la Dashboard tramite le assegnazioni attive (camera → struttura), mai tramite `struttura_preferita_id`.
- Nessuna nuova infrastruttura: si riusa il pattern esistente di `useStrutturaFilter`.
