import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, FileText, X, Download } from 'lucide-react';

const STATI = ['ricevuta', 'in_valutazione', 'approvata', 'rifiutata', 'ritirata'] as const;
const STATO_LABELS: Record<string, string> = {
  ricevuta: 'Ricevuta', in_valutazione: 'In valutazione', approvata: 'Approvata',
  rifiutata: 'Rifiutata', ritirata: 'Ritirata', sostituita: 'Sostituita',
};
const STATO_COLORS: Record<string, string> = {
  ricevuta: 'bg-primary/10 text-primary', in_valutazione: 'bg-warning/10 text-warning',
  approvata: 'bg-success/10 text-success', rifiutata: 'bg-destructive/10 text-destructive',
  ritirata: 'bg-muted text-muted-foreground', sostituita: 'bg-muted text-muted-foreground',
};

export default function Candidature() {
  const [search, setSearch] = useState('');
  const [filterStato, setFilterStato] = useState<string>('tutti');
  const [selected, setSelected] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: candidature, isLoading } = useQuery({
    queryKey: ['candidature', filterStato],
    queryFn: async () => {
      let query = supabase
        .from('candidature')
        .select('*, studenti(nome, cognome, email, telefono, nazionalita), strutture(nome)')
        .order('created_at', { ascending: false });
      if (filterStato !== 'tutti') query = query.eq('stato', filterStato);
      const { data } = await query;
      return data ?? [];
    },
  });

  const { data: documenti } = useQuery({
    queryKey: ['documenti', selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase.from('documenti').select('*').eq('candidatura_id', selected.id);
      return data ?? [];
    },
  });

  const updateStato = useMutation({
    mutationFn: async ({ id, stato, note }: { id: string; stato: string; note?: string }) => {
      const { data: old } = await supabase.from('candidature').select('stato').eq('id', id).single();
      await supabase.from('candidature').update({ stato, note_admin: note }).eq('id', id);
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('log_stato_candidature').insert({
        candidatura_id: id, stato_precedente: old?.stato, stato_nuovo: stato, cambiato_da: user?.id, note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidature'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: 'Stato aggiornato' });
    },
  });

  const filtered = candidature?.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.studenti?.nome?.toLowerCase().includes(s) || c.studenti?.cognome?.toLowerCase().includes(s) || c.studenti?.email?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Candidature</h1>
        <p className="text-[13px] text-muted-foreground">Gestisci le candidature degli studenti</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca per nome o email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStato} onValueChange={setFilterStato}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            {STATI.map(s => <SelectItem key={s} value={s}>{STATO_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Studente</th>
                <th className="text-left px-4 py-3 font-semibold">Struttura</th>
                <th className="text-left px-4 py-3 font-semibold">Anno</th>
                <th className="text-left px-4 py-3 font-semibold">Stato</th>
                <th className="text-left px-4 py-3 font-semibold">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((c: any, i: number) => (
                <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-border/30 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setSelected(c)}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{c.studenti?.nome} {c.studenti?.cognome}</p>
                    <p className="text-[11px] text-muted-foreground">{c.studenti?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{c.strutture?.nome || '-'}</td>
                  <td className="px-4 py-3 text-sm">{c.anno_accademico}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATO_COLORS[c.stato]}`}>
                      {STATO_LABELS[c.stato]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(c.created_at).toLocaleDateString('it-IT')}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered?.length === 0 && (
          <div className="py-12 text-center">
            <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground">Nessuna candidatura trovata</p>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.studenti?.nome} {selected.studenti?.cognome}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Section title="Dati studente" items={[
                  ['Email', selected.studenti?.email],
                  ['Telefono', selected.studenti?.telefono],
                  ['Nazionalità', selected.studenti?.nazionalita],
                ]} />
                <Section title="Dati accademici" items={[
                  ['Università', selected.universita_snapshot],
                  ['Corso', selected.corso_snapshot],
                  ['Anno', selected.anno_corso_snapshot],
                  ['Matricola', selected.matricola_snapshot],
                ]} />
                <Section title="Preferenze" items={[
                  ['Struttura', selected.strutture?.nome || '-'],
                  ['Tipo camera', selected.tipo_camera_preferito || '-'],
                  ['Periodo', `${selected.periodo_inizio || ''} → ${selected.periodo_fine || ''}`],
                  ['Anno acc.', selected.anno_accademico],
                ]} />
                {selected.messaggio && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Messaggio</p>
                    <p className="text-sm">{selected.messaggio}</p>
                  </div>
                )}

                {/* Documenti */}
                {documenti && documenti.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Documenti</p>
                    <div className="space-y-2">
                      {documenti.map((d: any) => (
                        <a key={d.id} href={d.url} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-primary hover:underline">
                          <Download className="w-3.5 h-3.5" /> {d.nome_file}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stato actions */}
                <div>
                  <p className="text-sm font-semibold mb-2">Cambia stato</p>
                  <div className="flex gap-2 flex-wrap">
                    {selected.stato === 'ricevuta' && (
                      <Button size="sm" onClick={() => updateStato.mutate({ id: selected.id, stato: 'in_valutazione' })}>
                        Prendi in carico
                      </Button>
                    )}
                    {selected.stato === 'in_valutazione' && (
                      <>
                        <Button size="sm" onClick={() => updateStato.mutate({ id: selected.id, stato: 'approvata' })}>
                          Approva
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => updateStato.mutate({ id: selected.id, stato: 'rifiutata' })}>
                          Rifiuta
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Admin notes */}
                <div>
                  <p className="text-sm font-semibold mb-2">Note admin</p>
                  <Textarea
                    defaultValue={selected.note_admin || ''}
                    placeholder="Note interne..."
                    onBlur={e => {
                      if (e.target.value !== (selected.note_admin || '')) {
                        supabase.from('candidature').update({ note_admin: e.target.value }).eq('id', selected.id).then(() => {
                          queryClient.invalidateQueries({ queryKey: ['candidature'] });
                        });
                      }
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, items }: { title: string; items: [string, string | null | undefined][] }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-2">{title}</p>
      <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
        {items.map(([label, value]) => (
          <div key={label} className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value || '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
