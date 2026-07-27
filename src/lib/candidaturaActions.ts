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
  | 'segna_rinuncia'
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
  esito_email_stato?: string | null;
  token_scade_il?: string | null;
  completata_il?: string | null;
  studenti?: { email?: string | null } | null;
}

/** Stato di riapertura dopo approvazione/rifiuto. */
export function reopenStato(c: CandidaturaLike): 'completata' | 'ricevuta' {
  return (c.versione_form === 'completa' || c.completata_il) ? 'completata' : 'ricevuta';
}

const ACTION_META: Record<CandidaturaActionId, Omit<CandidaturaAction, 'id'>> = {
  invia_form_completo: { label: 'Invia form completo', icon: Send, group: 'stato' },
  invia_esito:         { label: 'Invia comunicazione esito', icon: MailCheck, group: 'stato' },
  approva:             { label: 'Approva', icon: CheckCircle2, group: 'stato' },
  rifiuta:             { label: 'Rifiuta', icon: XCircle, group: 'stato' },
  riapri:              { label: 'Riapri', icon: RotateCcw, group: 'stato' },
  segna_rinuncia:      { label: 'Segna come rinuncia', icon: Archive, group: 'stato' },
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
  if ((stato === 'approvata' || stato === 'rifiutata') && c.esito_email_stato === 'da_inviare') {
    out.push(make('invia_esito'));
  }
  if (stato === 'ricevuta' || stato === 'completata') {
    out.push(make('approva'));
    out.push(make('rifiuta'));
  }
  if (stato === 'approvata' || stato === 'rifiutata') {
    out.push(make('riapri'));
  }
  if (stato !== 'ritirata' && stato !== 'sostituita') {
    out.push(make('segna_rinuncia'));
  }
  if (stato === 'approvata') out.push(make('assegna_camera'));
  if (c.studenti?.email) out.push(make('contatta'));
  out.push(make('elimina'));

  return out;
}