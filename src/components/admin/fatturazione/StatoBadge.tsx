import { cn } from '@/lib/utils';
import { voceStato, type VoceStato } from '@/lib/statiFatturazione';

export function StatoBadge({ mappa, stato, className }: {
  mappa: Record<string, VoceStato>;
  stato: string | null | undefined;
  className?: string;
}) {
  const v = voceStato(mappa, stato);
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', v.classi, className)}>
      {v.etichetta}
    </span>
  );
}
