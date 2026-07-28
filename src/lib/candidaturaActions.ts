import type { LucideIcon } from 'lucide-react';
import {
  Send, MailCheck, XCircle, Archive, DoorOpen, Mail, Trash2, Undo2,
} from 'lucide-react';

/**
 * Le azioni disponibili su una candidatura si decidono dallo **stadio persona**
 * (vista `v_studenti_stadio`), non dallo stato candidatura. La lista è
 * intenzionalmente breve: mostrare pochi verbi coerenti con la posizione della
 * persona nel processo evita menu di 8 voci quasi tutte non pertinenti.
 */

export type CandidaturaActionId =
  | 'invia_form_completo'
  | 'invia_esito'
  | 'assegna_camera'
  | 'metti_in_attesa_posto'
  | 'rifiuta'
  | 'annulla_assegnazione'
  | 'contatta'
  | 'elimina';

export type CandidaturaActionGroup = 'principale' | 'secondaria' | 'pericolosa';

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
  studente_id?: string | null;
  studenti?: { email?: string | null } | null;
  /** Stadio letto dalla vista v_studenti_stadio. Se assente si ricade sullo stato. */
  stadio?: string | null;
}

export function esitoInviato(c: CandidaturaLike): boolean {
  return !!c.esito_email_inviata_il;
}

const ACTION_META: Record<CandidaturaActionId, Omit<CandidaturaAction, 'id'>> = {
  invia_form_completo:   { label: 'Invia form completo', icon: Send, group: 'principale' },
  invia_esito:           { label: 'Comunica esito', icon: MailCheck, group: 'principale' },
  assegna_camera:        { label: 'Assegna posto', icon: DoorOpen, group: 'principale' },
  metti_in_attesa_posto: { label: 'Metti in lista d\'attesa', icon: Archive, group: 'secondaria' },
  rifiuta:               { label: 'Rifiuta', icon: XCircle, group: 'secondaria' },
  annulla_assegnazione:  { label: 'Annulla assegnazione', icon: Undo2, group: 'secondaria' },
  contatta:              { label: 'Contatta', icon: Mail, group: 'secondaria' },
  elimina:               { label: 'Elimina candidatura', icon: Trash2, group: 'pericolosa', destructive: true },
};

function make(id: CandidaturaActionId): CandidaturaAction {
  return { id, ...ACTION_META[id] };
}

/**
 * Restituisce le azioni pertinenti in base allo stadio persona.
 * Le voci sono ordinate: la prima del gruppo `principale` è quella che le
 * liste mostrano come pulsante primario; le altre finiscono nel menu overflow.
 */
export function getAvailableActions(c: CandidaturaLike): CandidaturaAction[] {
  const out: CandidaturaAction[] = [];
  const stadio = c.stadio ?? c.stato ?? '';

  switch (stadio) {
    case 'da_valutare':
      if (c.versione_form !== 'completa') out.push(make('invia_form_completo'));
      out.push(make('assegna_camera'));
      out.push(make('metti_in_attesa_posto'));
      out.push(make('rifiuta'));
      break;
    case 'in_attesa_studente':
      out.push(make('invia_form_completo'));
      out.push(make('rifiuta'));
      break;
    case 'da_decidere':
      out.push(make('assegna_camera'));
      out.push(make('metti_in_attesa_posto'));
      out.push(make('rifiuta'));
      break;
    case 'in_attesa_posto':
      out.push(make('assegna_camera'));
      out.push(make('metti_in_attesa_posto')); // per riordinare priorità
      out.push(make('rifiuta'));
      break;
    case 'assegnato':
      if (!esitoInviato(c)) out.push(make('invia_esito'));
      out.push(make('annulla_assegnazione'));
      break;
    case 'in_casa':
      // Concludi / trasferisci vivono sulla riga Residenti.
      break;
    case 'archiviato':
      // Solo azioni non-critiche.
      break;
    default:
      break;
  }

  if (c.studenti?.email) out.push(make('contatta'));
  if (stadio === 'archiviato' || stadio === 'da_valutare' || stadio === 'in_attesa_studente') {
    out.push(make('elimina'));
  }
  return out;
}