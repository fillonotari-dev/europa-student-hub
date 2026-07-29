## Diagnosi

Nel DB `public.impostazioni` c'è:
- `contatto_email` = `studentatoeuropa@gmail.com`
- `contatto_telefono` = **vuoto**
- `contatto_whatsapp` = **vuoto**
- `contatto_orari` = `Lun-Ven, dalle 9:00 alle 18:00`
- `notifica_email` = `studentatoeuropa@gmail.com`

Ci sono però due punti dove appaiono valori "inventati":

### Causa 1 — Anteprime nel pannello Cloud → Emails
`registry.ts` passa a ogni template un oggetto `CONTATTI_PREVIEW` hardcoded con `info@studentatoeuropa.it`, `+39 059 000 0000`, `+39 340 000 0000`. Serviva solo a mostrare il blocco contatti nell'anteprima, ma è fuorviante: sembra che quei valori vengano davvero inviati.

### Causa 2 — Fallback per-campo in `getContatti`
`_shared/contatti.ts` sostituisce ogni campo vuoto con `CONTATTI_DEFAULT`. Oggi:
- `contatto_email` default = `info@studentatoeuropa.it` → se un domani l'admin svuota il campo, le email al candidato riportano un indirizzo non più usato.
- `contatto_telefono` / `contatto_whatsapp` default = `''` → oggi va bene, ma la logica per-campo è ambigua (mescola default reali e "placeholder"). Meglio essere espliciti: mai inventare telefono/whatsapp/orari.

Le email reali ora dovrebbero mostrare `studentatoeuropa@gmail.com` e nessun telefono. Il "info@" e i telefoni placeholder che l'utente vede vengono dal pannello anteprima.

## Intervento

### 1. `supabase/functions/_shared/transactional-email-templates/registry.ts`
- Rimuovere la costante `CONTATTI_PREVIEW` con dati inventati.
- Sostituirla con `CONTATTI_PREVIEW_EMPTY = {}` (o omettere del tutto `contatti` dai `previewData`), così l'anteprima nel pannello mostra esattamente quello che vede il candidato reale quando telefono/whatsapp non sono configurati.
- In alternativa (opzione più ricca ma più invasiva): far renderizzare `preview-transactional-email` dopo aver letto la vera riga `impostazioni`, iniettando `contatti` reali nei `previewData`. Preferisco l'opzione minimale (previewData vuoti) — coerente, semplice, zero query extra.

### 2. `supabase/functions/_shared/contatti.ts`
- `CONTATTI_DEFAULT.contatto_email` → `''` (non inventare più `info@…`). Il template già gestisce `email` vuoto (nasconde la riga; il footer di `candidatura-ricevuta` ha già il fallback "contatta la Direzione").
- `CONTATTI_DEFAULT.notifica_email` resta `studentatoeuropa@gmail.com` (serve per non perdere le notifiche interne se qualcuno svuota il campo).
- Cambiare la logica in `getContatti`: telefono/whatsapp/orari/contatto_email → passano attraverso `normStr` senza fallback (stringa vuota se vuoti). Solo `notifica_email` mantiene il fallback al default.

### 3. Deploy
Dopo l'edit: deploy delle Edge Functions impattate (che importano il modulo condiviso e il registry):
- `submit-candidatura`
- `complete-candidatura`
- `send-esito-email`
- `generate-completion-link`
- `send-transactional-email`
- `preview-transactional-email`

## Verifica

1. Aprire Cloud → Emails → App emails → aprire l'anteprima di `candidatura-ricevuta`: il blocco "Contatti" deve mostrare **solo** i campi valorizzati (`Email: studentatoeuropa@gmail.com`, `Orari: Lun-Ven…`) e **nessuna** riga telefono/WhatsApp.
2. Inviare una candidatura di test: l'email al candidato deve mostrare gli stessi valori del pannello Impostazioni.
3. Compilare telefono in Impostazioni e ripetere: il nuovo campo compare in email e in anteprima.

## Fuori scope

- Non tocco pagina `/admin/impostazioni`, template `.tsx` dei singoli messaggi, coda email, o notifiche admin.
- Non introduco nuove tabelle o migrazioni.
