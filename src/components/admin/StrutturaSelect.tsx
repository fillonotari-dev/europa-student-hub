import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { StrutturaOpt } from '@/hooks/useStrutturaFilter';

type Props = {
  value: string;
  onChange: (v: string) => void;
  strutture: StrutturaOpt[];
  className?: string;
};

export function StrutturaSelect({ value, onChange, strutture, className }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? 'w-[180px]'}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="tutti">Tutte le strutture</SelectItem>
        {strutture.map(s => (
          <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}