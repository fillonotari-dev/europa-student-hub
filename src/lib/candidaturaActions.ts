import type { LucideIcon } from 'lucide-react';
import {
  Send, MailCheck, CheckCircle2, XCircle, RotateCcw, Archive,
  DoorOpen, Mail, Trash2,
} from 'lucide-react';

export type CandidaturaActionId =
  | 'invia_form_completo'
  | 'invia_esito'
  | 'approva'
  | 'rifiuta'
  | 'riapri'
  | 'metti_in_attesa_posto'
  | 'assegna_camera'
  | 'contatta'
  | 'elimina';

export type CandidaturaActionGroup = 'stato' | 'operativa' | 'pericolosa';

export interface CandidaturaAction {
  id: CandidaturaActionId;
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  group: CandidaturaActionGroup;
}

export interface CandidaturaLike {
  id: string;
  stato?: string | null;
  versione_form?: string | null;
  esito_email_inviata_il?: string | null;
  token_scade_il?: string | null;
  completata_il?: string | null;
  studenti?: { email?: string | null } | null;
}

/** Stato di riapertura dopo accoglimento/rifiuto. */
export function reopenStato(c: CandidaturaLike): 'da_decidere' | 'da_valutare' {
  return (c.versione_form === 'completa' || c.completata_il) ? 'da_decidere' : 'da_valutare';
}

/** L'esito è stato comunicato allo studente via email. */
export function esitoInviato(c: CandidaturaLike): boolean {
  return !!c.esito_email_inviata_il;
}

const ACTION_META: Record<CandidaturaActionId, Omit<CandidaturaAction, 'id'>> = {
  invia_form_completo: { label: 'Invia form completo', icon: Send, group: 'stato' },
  invia_esito:         { label: 'Invia comunicazione esito', icon: MailCheck, group: 'stato' },
  approva:             { label: 'Accogli', icon: CheckCircle2, group: 'stato' },
  rifiuta:             { label: 'Rifiuta', icon: XCircle, group: 'stato' },
  riapri:              { label: 'Riapri', icon: RotateCcw, group: 'stato' },
  metti_in_attesa_posto: { label: 'Metti in attesa di posto', icon: Archive, group: 'stato' },
  assegna_camera:      { label: 'Assegna a camera', icon: DoorOpen, group: 'operativa' },
  contatta:            { label: 'Contatta studente', icon: Mail, group: 'operativa' },
  elimina:             { label: 'Elimina candidatura', icon: Trash2, group: 'pericolosa', destructive: true },
};

function make(id: CandidaturaActionId): CandidaturaAction {
  return { id, ...ACTION_META[id] };
}

export function getAvailableActions(c: CandidaturaLike): CandidaturaAction[] {
  const out: CandidaturaAction[] = [];
  const stato = c.stato;

  if (c.versione_form !== 'completa') out.push(make('invia_form_completo'));
  if ((stato === 'accolta' || stato === 'rifiutata') && !esitoInviato(c)) {
    out.push(make('invia_esito'));
  }
  if (stato === 'da_valutare' || stato === 'da_decidere') {
    out.push(make('approva'));
    out.push(make('rifiuta'));
  }
  if (stato === 'accolta' || stato === 'rifiutata') {
    out.push(make('riapri'));
  }
  if (stato === 'accolta') {
    out.push(make('metti_in_attesa_posto'));
  }
  if (stato === 'accolta') out.push(make('assegna_camera'));
  if (c.studenti?.email) out.push(make('contatta'));
  out.push(make('elimina'));

  return out;
}