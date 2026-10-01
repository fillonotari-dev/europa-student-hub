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
  annullata: { etichetta: 'Annullata', classi: 'bg-muted text-muted-foreground' },
};

const CLASSI_SDI = {
  neutro: 'bg-muted text-foreground',
  successo: 'bg-success/15 text-success',
  attenzione: 'bg-warning/15 text-warning-foreground',
  errore: 'bg-destructive/10 text-destructive',
} as const;

export type VoceSdi = VoceStato & { spiegazione?: string; nota?: string };

/**
 * Etichetta dello stato di invio allo SDI (fatture.ei_status, schema
 * IssuedDocument di Fatture in Cloud), letta insieme al codice destinatario
 * dell'intestazione: 0000000 = nessun indirizzo telematico, XXXXXXX = estero.
 */
export function etichettaSdi(eiStatus: string | null | undefined, codiceDestinatario?: string | null): VoceSdi {
  const cod = (codiceDestinatario ?? '').trim().toUpperCase();
  const estero = cod === 'XXXXXXX';
  const conNota = (v: VoceSdi): VoceSdi => (estero ? { ...v, nota: 'copia da inviare allo studente' } : v);
  switch (eiStatus) {
    case 'not_sent':
      return { etichetta: 'Da emettere', classi: CLASSI_SDI.neutro };
    case 'attempt': case 'sent': case 'pending': case 'processing':
      return conNota({ etichetta: 'Emessa, in attesa di esito', classi: CLASSI_SDI.successo });
    case 'accepted':
      return conNota({ etichetta: 'Emessa e consegnata', classi: CLASSI_SDI.successo });
    case 'not_delivered':
      if (cod === '0000000') {
        return {
          etichetta: 'Emessa · nel cassetto fiscale dello studente', classi: CLASSI_SDI.successo,
          spiegazione: 'Lo SDI non ha un indirizzo di recapito: la fattura è valida ed è disponibile nel cassetto fiscale dello studente.',
        };
      }
      if (estero) return conNota({ etichetta: 'Emessa', classi: CLASSI_SDI.successo });
      return { etichetta: 'Recapito non riuscito', classi: CLASSI_SDI.attenzione };
    case 'discarded': case 'error':
      return { etichetta: 'Scartata dallo SDI: va riemessa', classi: CLASSI_SDI.errore };
    case 'rejected':
      return { etichetta: 'Rifiutata dal destinatario: va riemessa', classi: CLASSI_SDI.errore };
    case 'manual_rejected':
      return { etichetta: 'Rifiutata (esito manuale): va riemessa', classi: CLASSI_SDI.errore };
    case 'no_response':
      return conNota({ etichetta: 'Emessa, nessuna risposta dal destinatario', classi: CLASSI_SDI.successo });
    case 'manual_accepted':
      return conNota({ etichetta: 'Emessa e consegnata (esito manuale)', classi: CLASSI_SDI.successo });
    case 'missing':
      return { etichetta: 'Stato non disponibile', classi: CLASSI_SDI.neutro };
    default:
      return { etichetta: eiStatus || '—', classi: 'bg-muted text-muted-foreground' };
  }
}

/** Stati SDI per cui la fattura va riemessa: entrano nell'avviso di Fatturazione. */
export const SDI_DA_RIEMETTERE: ReadonlySet<string> = new Set(['discarded', 'error', 'rejected', 'manual_rejected']);

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
