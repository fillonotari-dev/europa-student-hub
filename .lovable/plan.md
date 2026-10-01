# Bozze mancanti per le assegnazioni nate prima della bozza automatica

## Stato verificato
- Le assegnazioni attive senza un contratto in bozza o attivo sono 20 (lette con una SELECT sulle assegnazioni con `stato = 'attiva'` senza contratto bozza/attivo collegato). Il risultato è lo stesso cercando il contratto per studente.
- Il filtro per stato esiste già in /admin/contratti (`?stato=`, src/pages/admin/Contratti.tsx:65 e 120-126).
- L'area /admin è protetta da AdminLayout, che legge `user_roles` (src/pages/admin/AdminLayout.tsx; route in src/App.tsx:42-47). Le scritture sui contratti sono permesse solo agli admin dalla regola di sicurezza della tabella: `has_role(auth.uid(), 'admin')`.

## 1. Pulsante in /admin/contratti
- Sopra l'elenco: «Prepara le bozze mancanti (N)», visibile solo quando N > 0.
- N viene da una lettura: assegnazioni attive, meno quelle che hanno un contratto bozza o attivo con quell'`assegnazione_id`. È lo stesso criterio usato da `creaBozzaDaAssegnazione`.

## 2. Dialogo di conferma (nessuna scrittura prima della conferma)
- In testa: «Verranno create N bozze di contratto. Nessun contratto viene attivato e nessuna mensilità viene generata: ogni bozza va verificata e attivata a mano.»
- Per ogni assegnazione: persona, periodo, sede e tipo camera, canone proposto («da listino X €» oppure «da inserire»), più «intestazione: verrà creata a nome dello studente» quando lo studente non ne ha una.
- Il canone si legge con `cercaListino` e il criterio di `canoneDaListino`, dallo stesso modulo: nessuna regola duplicata.
- Pulsanti «Annulla» e «Crea N bozze».

## 3. Creazione
- Alla conferma: `creaBozzaDaAssegnazione` per ciascuna, una alla volta, usata così com'è. Non solleva errori, quindi un errore su una non ferma le altre. Durante il giro il dialogo non si può chiudere e mostra l'avanzamento.

## 4. Riepilogo finale
- Resta a schermo nello stesso dialogo, una riga per persona: «creata» con il link alla bozza, «esisteva già», oppure «non creata» con il motivo in italiano.
- Link «Vai alle bozze da verificare», che apre /admin/contratti?stato=bozza.
- A fine giro aggiorna i dati dei contratti, dei residenti e il conteggio N.

## 5. Documentazione
- docs/Context.md: nuova voce sulla regolarizzazione delle assegnazioni senza contratto, con file e riga.
- roadmap.md: nuova voce.

## Dettagli tecnici
- Nuovo componente `src/components/admin/contratti/BozzeMancantiDialog.tsx`, in un file suo e non dentro un altro componente.
- Nuova lettura delle assegnazioni senza contratto in `src/lib/precompilaContratto.ts`. Restituisce assegnazione, studente, camera, sede e intestazione esistente; solo letture.
- Il pulsante entra in Contratti.tsx accanto al filtro; l'aggiornamento dei dati usa le chiavi `contratti` e `studente-contratti` e quella dei residenti.

## Verifica
- Controllo dei tipi e test. Nel browser, in sola lettura: il pulsante mostra 20 e il dialogo elenca le 20 assegnazioni. Non premo «Crea N bozze».
- Nessuna migration, nessun dato scritto.
