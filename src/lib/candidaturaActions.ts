import type { LucideIcon } from 'lucide-react';
import {
  Send, MailCheck, XCircle, Archive, DoorOpen, Mail, Trash2, Undo2,
  ArrowRightLeft, LogOut, RefreshCw, PlusCircle,
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
  | 'trasferisci'
  | 'rinnova_soggiorno'
  | 'nuovo_soggiorno'
  | 'concludi_soggiorno'
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
  studenti?: { email?: string | null; nome?: string | null; cognome?: string | null } | null;
  /** Stadio letto dalla vista v_studenti_stadio. Se assente si ricade sullo stato. */
  stadio?: string | null;
  /** Assegnazione attiva corrente (usata da trasferisci/concludi_soggiorno). */
  assegnazione_id?: string | null;
  camera_id_corrente?: string | null;
  camera_numero_corrente?: string | null;
  struttura_nome_corrente?: string | null;
  data_fine_corrente?: string | null;
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
  trasferisci:           { label: 'Trasferisci in altra camera', icon: ArrowRightLeft, group: 'secondaria' },
  rinnova_soggiorno:     { label: 'Rinnova soggiorno', icon: RefreshCw, group: 'secondaria' },
  nuovo_soggiorno:       { label: 'Nuovo soggiorno', icon: PlusCircle, group: 'principale' },
  concludi_soggiorno:    { label: 'Concludi soggiorno', icon: LogOut, group: 'pericolosa', destructive: true },
  contatta:              { label: 'Contatta', icon: Mail, group: 'secondaria' },
  elimina:               { label: 'Elimina candidatura', icon: Trash2, group: 'pericolosa', destructive: true },
};

function make(id: CandidaturaActionId): CandidaturaAction {
  return { id, ...ACTION_META[id] };
}

function makeAs(id: CandidaturaActionId, group: CandidaturaActionGroup): CandidaturaAction {
  return { id, ...ACTION_META[id], group };
}

export interface AvailableActionsOpts {
  /** True se la persona ha MAI avuto un'assegnazione (anche conclusa). Blocca `elimina`. */
  haAvutoAssegnazione?: boolean;
}

/**
 * Restituisce le azioni pertinenti in base allo stadio persona.
 * Le voci sono ordinate: la prima del gruppo `principale` è quella che le
 * liste mostrano come pulsante primario; le altre finiscono nel menu overflow.
 */
export function getAvailableActions(c: CandidaturaLike, opts: AvailableActionsOpts = {}): CandidaturaAction[] {
  const out: CandidaturaAction[] = [];
  const stadio = c.stadio ?? c.stato ?? '';

  switch (stadio) {
    case 'da_valutare':
      if (c.versione_form !== 'completa') {
        // Principale: chiedere i dati. Assegna/attesa retrocedono a secondarie.
        out.push(make('invia_form_completo'));
        out.push(makeAs('assegna_camera', 'secondaria'));
        out.push(makeAs('metti_in_attesa_posto', 'secondaria'));
      } else {
        // Form già completo: assegna_camera resta principale per non lasciare la riga senza pulsante primario.
        out.push(make('assegna_camera'));
        out.push(make('metti_in_attesa_posto'));
      }
      out.push(make('rifiuta'));
      break;
    case 'in_attesa_studente':
      out.push(make('invia_form_completo'));
      out.push(makeAs('assegna_camera', 'secondaria'));
      out.push(makeAs('metti_in_attesa_posto', 'secondaria'));
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
      // Niente trasferisci qui: chiuderebbe la vecchia riga a nuovo_inizio-1
      // e su un'assegnazione non ancora cominciata farebbe daterange invertito
      // → il vincolo GIST esplode. Per rimpiazzare, si annulla e si riassegna.
      out.push(make('annulla_assegnazione'));
      break;
    case 'in_casa':
      if (c.assegnazione_id) {
        out.push(make('trasferisci'));
        out.push(make('rinnova_soggiorno'));
      }
      break;
    case 'archiviato':
      out.push(make('nuovo_soggiorno'));
      break;
    default:
      break;
  }

  // invia_esito compare per ogni candidatura accolta/rifiutata: se l'email non
  // è mai stata inviata la label è "Invia esito"; altrimenti "Reinvia esito".
  // Regola allargata così l'operatore ha sempre una rete se l'invio in-gesto è fallito.
  if (c.stato === 'accolta' || c.stato === 'rifiutata') {
    const a = make('invia_esito');
    a.label = c.esito_email_inviata_il ? 'Reinvia esito' : 'Invia esito';
    out.push(a);
  }

  if (c.studenti?.email) out.push(make('contatta'));

  // concludi_soggiorno è pericolosa: la mostriamo in coda per finire nel gruppo destructive del menu.
  if (stadio === 'in_casa' && c.assegnazione_id) {
    out.push(make('concludi_soggiorno'));
  }

  if (
    (stadio === 'archiviato' || stadio === 'da_valutare' || stadio === 'in_attesa_studente'
      || stadio === 'da_decidere' || stadio === 'in_attesa_posto')
    && !opts.haAvutoAssegnazione
  ) {
    out.push(make('elimina'));
  }
  return out;
}