/**
 * Etichette italiane e classi (soli token semantici) degli stati di fatture e
 * mensilità. I valori nel database NON cambiano: questa è solo la loro
 * presentazione. Modello: STATO_CONTRATTO_COLORS in src/pages/admin/Contratti.tsx.
 *
 * Vocabolario: il gestionale CREA la fattura su Fatture in Cloud; l'emissione
 * è la trasmissione allo SDI. Per questo `emessa` si legge «Creata su Fatture
 * in Cloud» ed è neutra, non un successo.
 */

export type VoceStato = { etichetta: string; classi: string };

export const STATO_FATTURA: Record<string, VoceStato> = {
  in_invio: { etichetta: 'In creazione', classi: 'bg-warning/15 text-warning-foreground' },
  emessa: { etichetta: 'Creata su Fatture in Cloud', classi: 'bg-muted text-foreground' },
  errore: { etichetta: 'Errore', classi: 'bg-destructive/10 text-destructive' },
};

export const STATO_CANONE: Record<string, VoceStato> = {
  da_fatturare: { etichetta: 'Da fatturare', classi: 'bg-muted text-foreground' },
  fatturato: { etichetta: 'Fatturata', classi: 'bg-primary/10 text-primary' },
  incassato: { etichetta: 'Pagata', classi: 'bg-success/15 text-success' },
  annullato: { etichetta: 'Annullata', classi: 'bg-muted text-muted-foreground' },
};

/** Ripiego per un valore non mappato: mostra il valore grezzo, mai nulla. */
export function voceStato(mappa: Record<string, VoceStato>, stato: string | null | undefined): VoceStato {
  if (stato && mappa[stato]) return mappa[stato];
  return { etichetta: stato || '—', classi: 'bg-muted text-muted-foreground' };
}

/** Una frase per stato, per la descrizione del pannello «Da riconciliare». */
export const SPIEGAZIONE_RICONCILIAZIONE: Record<'in_invio' | 'emessa', string> = {
  in_invio: `${STATO_FATTURA.in_invio.etichetta}: la richiesta a Fatture in Cloud non ha avuto un esito certo; il documento potrebbe esistere e va verificato lì.`,
  emessa: `${STATO_FATTURA.emessa.etichetta}: il documento esiste, ma nessuna mensilità del gestionale è collegata.`,
};
