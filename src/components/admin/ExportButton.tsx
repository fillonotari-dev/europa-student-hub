import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { exportToXlsx } from '@/lib/exportXlsx';

interface ExportButtonProps {
  filename: string;
  getRows: () => Record<string, any>[];
  disabled?: boolean;
  label?: string;
}

export function ExportButton({ filename, getRows, disabled, label = 'Esporta Excel' }: ExportButtonProps) {
  const { toast } = useToast();

  const handleClick = () => {
    try {
      const rows = getRows();
      if (!rows.length) {
        toast({ title: 'Nessun dato da esportare', variant: 'destructive' });
        return;
      }
      exportToXlsx(filename, rows);
      toast({ title: 'Export completato', description: `${rows.length} righe esportate` });
    } catch (e: any) {
      toast({ title: 'Errore export', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={disabled}>
      <Download className="w-4 h-4 mr-1.5" />
      {label}
    </Button>
  );
}