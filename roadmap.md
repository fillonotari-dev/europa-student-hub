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
- [x] D2: fic-emetti-fattura risincronizza l'anagrafica (PUT idempotente) prima di creare il documento
- [x] Pagina /admin/fatturazione: lotto mensile con conferma umana, avviso arretrati, archivio, riconciliazione; emissione rimossa dalla scheda contratto
- [x] Interfaccia Fatturazione allineata a Contratti: filtri in URL, barra selezione sopra, archivio collassabile, tabelle uniformi
- [x] Importi personalizzati protetti dal cambio canone (aggiorna_canone_contratto + ContrattoPage + funzione pura testata)
- [x] due_date del documento da canoni.scadenza (ripiego fic_giorni_scadenza, arretrato = data di emissione) + 3 casi di test
- [x] Segnalazione mesi parzialmente coperti in /admin/fatturazione (src/lib/coperturaMese.ts + test)
- [x] totaleRiga delega a lordoDaImponibile: una sola implementazione della formula IVA
- [x] Tipo del documento come impostazione fic_emette_fatture (rimosse TIPO_DOCUMENTO e SCRITTURE_LOCALI_ATTIVE), interruttore in Impostazioni, modo dichiarato in pagina e nel dialogo
- [x] Ciclo di fatturazione chiuso e collaudato in proforma (550829694); docs/Context.md aggiornato con debiti dichiarati

Debiti aperti dichiarati:
- [ ] Componente tabella condiviso (e allineamento a destra degli importi) fra Contratti e Fatturazione
- [ ] fic-sync-anagrafica su _shared/fic-client.ts
- [ ] Azioni di risoluzione nel pannello di riconciliazione (oggi sola lettura)
- [ ] Email di trasmissione della fattura allo studente; trasmissione allo SDI resta manuale

- [x] Collegare fatture già esistenti su FIC (fic-collega-fattura, registra_fattura_esistente) e guardia doppioni in fic-emetti-fattura
- [x] Fattura elettronica completa: fic_ei_metodo_pagamento, ei_data, entity da mappatura, payment_terms, nuova descrizione, log di ciò che FIC salva
- [x] 409 di FIC come rifiuto definitivo, diagnostica su ogni 4xx (emetti, sync-anagrafica, collega), data odierna nel fuso Europe/Rome
- [x] Documentazione Context allineata a rifiuto 409, diagnostica 4xx e data italiana
- [x] Una sola strada: il gestionale crea sempre fatture (rimosso il modo proforma, vocabolario crea/emetti)
- [x] Fatturazione: stati leggibili (statiFatturazione.ts), due tab, archivio paginato con errori, mese proposto con arretrati, stato vuoto e prossimo lotto, Collega nel menu ⋯
- [x] Fatturazione: tabella del mese con le mensilità già fatturate, riepilogo fuori dalla tabella, prossimo lotto = primo mese con da fatturare

- [x] Riallineamento fatture: stato annullata, riallinea_fattura (solo service_role), varco nei trigger col segnale app.riallineamento
- [ ] Sincronizzatore che chiama riallinea_fattura ed etichetta «Annullata» (intervento successivo)
- [x] Correzione a riallinea_fattura: con p_esiste = true i parametri numero/numerazione/data/imponibile/iva/totale nulli sollevano parametri_riallineamento_mancanti (migration 0003); p_ei_status NULL = invariato
