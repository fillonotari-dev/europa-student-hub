import { Button } from '@/components/ui/button';
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { RowActions } from '@/components/admin/RowActions';
import { useCandidaturaActionsCtx } from '@/hooks/useCandidaturaActions';
import { getAvailableActions, type CandidaturaLike, type CandidaturaAction } from '@/lib/candidaturaActions';

function groupOf(actions: CandidaturaAction[]) {
  return {
    stato: actions.filter(a => a.group === 'stato'),
    operativa: actions.filter(a => a.group === 'operativa'),
    pericolosa: actions.filter(a => a.group === 'pericolosa'),
  };
}

function Menu({ candidatura }: { candidatura: CandidaturaLike }) {
  const { trigger } = useCandidaturaActionsCtx();
  const groups = groupOf(getAvailableActions(candidatura));
  return (
    <RowActions>
      {groups.stato.length > 0 && <DropdownMenuLabel>Cambia stato</DropdownMenuLabel>}
      {groups.stato.map(a => {
        const Icon = a.icon;
        return (
          <DropdownMenuItem key={a.id} onClick={() => trigger(a.id, candidatura)}>
            <Icon className="w-4 h-4 mr-2" /> {a.label}
          </DropdownMenuItem>
        );
      })}
      {groups.operativa.length > 0 && <DropdownMenuSeparator />}
      {groups.operativa.map(a => {
        const Icon = a.icon;
        return (
          <DropdownMenuItem key={a.id} onClick={() => trigger(a.id, candidatura)}>
            <Icon className="w-4 h-4 mr-2" /> {a.label}
          </DropdownMenuItem>
        );
      })}
      {groups.pericolosa.length > 0 && <DropdownMenuSeparator />}
      {groups.pericolosa.map(a => {
        const Icon = a.icon;
        return (
          <DropdownMenuItem
            key={a.id}
            className={a.destructive ? 'text-destructive focus:text-destructive' : ''}
            onClick={() => trigger(a.id, candidatura)}
          >
            <Icon className="w-4 h-4 mr-2" /> {a.label}
          </DropdownMenuItem>
        );
      })}
    </RowActions>
  );
}

function Buttons({ candidatura }: { candidatura: CandidaturaLike }) {
  const { trigger } = useCandidaturaActionsCtx();
  const actions = getAvailableActions(candidatura);
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(a => {
        const Icon = a.icon;
        const variant = a.destructive ? 'destructive' : a.group === 'stato' && (a.id === 'approva' || a.id === 'invia_form_completo' || a.id === 'invia_esito') ? 'default' : 'outline';
        return (
          <Button key={a.id} size="sm" variant={variant as any} onClick={() => trigger(a.id, candidatura)}>
            <Icon className="w-4 h-4 mr-1" /> {a.label}
          </Button>
        );
      })}
    </div>
  );
}

export const CandidaturaActions = { Menu, Buttons };