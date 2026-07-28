import { Button } from '@/components/ui/button';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { RowActions } from '@/components/admin/RowActions';
import { useCandidaturaActionsCtx } from '@/hooks/useCandidaturaActions';
import { getAvailableActions, type CandidaturaLike } from '@/lib/candidaturaActions';

/**
 * Menu di riga: mostra tutte le azioni disponibili senza separazione visiva
 * fra principali e secondarie (le liste sono corte per stadio). L'ultimo
 * gruppo "pericolosa" resta separato dal resto.
 */
function Menu({ candidatura }: { candidatura: CandidaturaLike }) {
  const { trigger } = useCandidaturaActionsCtx();
  const actions = getAvailableActions(candidatura);
  const safe = actions.filter(a => a.group !== 'pericolosa');
  const danger = actions.filter(a => a.group === 'pericolosa');
  return (
    <RowActions>
      {safe.map(a => {
        const Icon = a.icon;
        return (
          <DropdownMenuItem key={a.id} onClick={() => trigger(a.id, candidatura)}>
            <Icon className="w-4 h-4 mr-2" /> {a.label}
          </DropdownMenuItem>
        );
      })}
      {danger.length > 0 && safe.length > 0 && <DropdownMenuSeparator />}
      {danger.map(a => {
        const Icon = a.icon;
        return (
          <DropdownMenuItem
            key={a.id}
            className="text-destructive focus:text-destructive"
            onClick={() => trigger(a.id, candidatura)}
          >
            <Icon className="w-4 h-4 mr-2" /> {a.label}
          </DropdownMenuItem>
        );
      })}
    </RowActions>
  );
}

/** Pulsanti orizzontali (usati nella scheda persona): la prima "principale"
 *  diventa il default; il resto è outline; le pericolose sono destructive. */
function Buttons({ candidatura }: { candidatura: CandidaturaLike }) {
  const { trigger } = useCandidaturaActionsCtx();
  const actions = getAvailableActions(candidatura);
  let primaryTaken = false;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(a => {
        const Icon = a.icon;
        let variant: 'default' | 'outline' | 'destructive' = 'outline';
        if (a.destructive) variant = 'destructive';
        else if (a.group === 'principale' && !primaryTaken) { variant = 'default'; primaryTaken = true; }
        return (
          <Button key={a.id} size="sm" variant={variant} onClick={() => trigger(a.id, candidatura)}>
            <Icon className="w-4 h-4 mr-1" /> {a.label}
          </Button>
        );
      })}
    </div>
  );
}

export const CandidaturaActions = { Menu, Buttons };