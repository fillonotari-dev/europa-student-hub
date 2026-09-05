# Roadmap

- [x] Migration: crea_persona_manuale con stato derivato (accolta/in_attesa_posto) e log coerente
- [x] Esclusione esito manuale: studentiQuery (origine), CandidaturaBadges, candidaturaActions
- [x] Dialogo "Aggiungi persona" in Residenti + pulsante toolbar
- [x] Correzione frase in docs/Context.md §3 + nota stato derivato
- [x] Verifica build e controllo finale col piano
- [x] Collegamento Fatture in Cloud (sola lettura): secret, fic_log, fic-test-connection, sezione Impostazioni
- [x] Sincronizzazione anagrafica → cliente FIC: modulo condiviso, fic-sync-anagrafica, UI in scheda contratto
- [x] Split campiMancantiPerFic in campiMancantiPerFicSync / campiMancantiPerFattura + aggiornamento consumatori
- [x] Suite src/test/fic-anagrafica.test.ts: regole estero, soglie Italia, differenza email_recapito
- [x] Modifica intestazione fattura post-creazione: estrazione AnagraficaFatturazioneFields + IntestazioneFatturaDialog
- [x] Avvisi: mensilità già fatturate, intestazione condivisa da altri contratti, invito a risincronizzare
- [x] Cambio modalità intestazione: ricarica campi, conteggio sulla riga di destinazione (rigaDestinazioneAnagrafica + test), nota legata all'esito reale
- [ ] D2: fic-emetti-fattura deve risincronizzare l'anagrafica (PUT idempotente) prima di creare il documento
- [ ] Prossimo giro FIC: pagina /admin/fatturazione con voce di sidebar (parte operativa)
