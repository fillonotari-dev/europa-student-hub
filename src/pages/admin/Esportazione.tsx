import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

type ExportType = 'candidature' | 'studenti' | 'camere' | 'assegnazioni';

export default function Esportazione() {
  const [tipo, setTipo] = useState<ExportType>('candidature');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      let data: any[] = [];
      let filename = '';

      switch (tipo) {
        case 'candidature': {
          const { data: d } = await supabase.from('candidature')
            .select('*, studenti(nome, cognome, email, telefono, nazionalita)').order('created_at', { ascending: false });
          data = (d ?? []).map(c => ({
            'Nome': c.studenti?.nome, 'Cognome': c.studenti?.cognome, 'Email': c.studenti?.email,
            'Telefono': c.studenti?.telefono, 'Nazionalità': c.studenti?.nazionalita,
            'Università': c.universita_snapshot, 'Corso': c.corso_snapshot, 'Anno corso': c.anno_corso_snapshot,
            'Matricola': c.matricola_snapshot, 'Stato': c.stato, 'Anno accademico': c.anno_accademico,
            'Periodo inizio': c.periodo_inizio, 'Periodo fine': c.periodo_fine,
            'Data candidatura': new Date(c.created_at).toLocaleDateString('it-IT'),
          }));
          filename = 'candidature';
          break;
        }
        case 'studenti': {
          const { data: d } = await supabase.from('studenti').select('*').order('cognome');
          data = (d ?? []).map(s => ({
            'Cognome': s.cognome, 'Nome': s.nome, 'Email': s.email, 'Telefono': s.telefono,
            'Nazionalità': s.nazionalita, 'Data nascita': s.data_nascita,
            'Università': s.universita, 'Corso': s.corso_di_studi, 'Anno': s.anno_di_corso, 'Matricola': s.matricola,
          }));
          filename = 'studenti';
          break;
        }
        case 'camere': {
          const { data: d } = await supabase.from('camere').select('*, strutture(nome)').order('piano').order('numero');
          data = (d ?? []).map(c => ({
            'Struttura': c.strutture?.nome, 'Numero': c.numero, 'Piano': c.piano,
            'Tipo': c.tipo, 'Posti': c.posti, 'Stato': c.stato,
          }));
          filename = 'camere';
          break;
        }
        case 'assegnazioni': {
          const { data: d } = await supabase.from('assegnazioni')
            .select('*, studenti(nome, cognome), camere(numero, strutture(nome))').order('created_at', { ascending: false });
          data = (d ?? []).map((a: any) => ({
            'Studente': `${a.studenti?.cognome} ${a.studenti?.nome}`, 'Camera': a.camere?.numero,
            'Struttura': a.camere?.strutture?.nome, 'Posto': a.posto,
            'Data inizio': a.data_inizio, 'Data fine': a.data_fine, 'Stato': a.stato,
          }));
          filename = 'assegnazioni';
          break;
        }
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, filename);
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([buf]), `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Export completato' });
    } catch (err: any) {
      toast({ title: 'Errore nell\'export', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Esportazione</h1>
        <p className="text-[13px] text-muted-foreground">Esporta i dati in formato Excel</p>
      </div>

      <div className="bg-card border border-border/50 rounded-lg p-6 max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Export Excel</p>
            <p className="text-[13px] text-muted-foreground">Seleziona i dati da esportare</p>
          </div>
        </div>

        <div className="space-y-4">
          <Select value={tipo} onValueChange={v => setTipo(v as ExportType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="candidature">Candidature</SelectItem>
              <SelectItem value="studenti">Studenti</SelectItem>
              <SelectItem value="camere">Camere e occupazione</SelectItem>
              <SelectItem value="assegnazioni">Storico assegnazioni</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleExport} disabled={loading} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            {loading ? 'Esportazione...' : 'Scarica Excel'}
          </Button>
        </div>
      </div>
    </div>
  );
}
