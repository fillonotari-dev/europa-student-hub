import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { RowActions } from '@/components/admin/RowActions';
import { useCandidaturaActionsCtx } from '@/hooks/useCandidaturaActions';
import { getAvailableActions, type CandidaturaLike } from '@/lib/candidaturaActions';

/**
 * Menu di riga: mostra tutte le azioni disponibili senza separazione visiva
 * fra principali e secondarie (le liste sono corte per stadio). L'ultimo
 * gruppo "pericolosa" resta separato dal resto.
 */
function Menu({ candidatura }: { candidatura: CandidaturaLike }) {
  const { trigger, haAvutoAssegnazione } = useCandidaturaActionsCtx();
  const actions = getAvailableActions(candidatura, { haAvutoAssegnazione: haAvutoAssegnazione(candidatura) });
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
  const { trigger, haAvutoAssegnazione } = useCandidaturaActionsCtx();
  const actions = getAvailableActions(candidatura, { haAvutoAssegnazione: haAvutoAssegnazione(candidatura) });
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

/** Azione principale come pulsante pieno + tutte le altre in un menu "Azioni".
 *  Usato nella scheda persona dove la lunga fila di pulsanti diventava illeggibile. */
function PrimaryWithMenu({ candidatura }: { candidatura: CandidaturaLike }) {
  const { trigger, haAvutoAssegnazione } = useCandidaturaActionsCtx();
  const actions = getAvailableActions(candidatura, { haAvutoAssegnazione: haAvutoAssegnazione(candidatura) });
  const primary = actions.find(a => a.group === 'principale' && !a.destructive) ?? null;
  const rest = actions.filter(a => a !== primary);
  const safe = rest.filter(a => a.group !== 'pericolosa');
  const danger = rest.filter(a => a.group === 'pericolosa');
  const PIcon = primary?.icon;
  return (
    <div className="flex items-center gap-2">
      {primary && PIcon && (
        <Button size="sm" onClick={() => trigger(primary.id, candidatura)}>
          <PIcon className="w-4 h-4 mr-1" /> {primary.label}
        </Button>
      )}
      {(safe.length + danger.length) > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              Azioni <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
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
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export const CandidaturaActions = { Menu, Buttons, PrimaryWithMenu };