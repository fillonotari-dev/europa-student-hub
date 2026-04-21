import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Search, Users as UsersIcon } from 'lucide-react';

export default function Residenti() {
  const [search, setSearch] = useState('');

  const { data: residenti } = useQuery({
    queryKey: ['residenti'],
    queryFn: async () => {
      const { data } = await supabase
        .from('assegnazioni')
        .select('id, studenti(id, nome, cognome, email, nazionalita), camere(numero, strutture(nome))')
        .eq('stato', 'attiva');
      return data ?? [];
    },
  });

  const filtered = residenti
    ?.filter((a: any) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const s = a.studenti;
      if (!s) return false;
      return s.nome?.toLowerCase().includes(q) || s.cognome?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
    })
    .sort((a: any, b: any) => (a.studenti?.cognome ?? '').localeCompare(b.studenti?.cognome ?? ''));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Residenti</h1>
        <p className="text-[13px] text-muted-foreground">Studenti con assegnazione attiva</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Cerca residente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-3 font-semibold">Nome</th>
              <th className="text-left px-4 py-3 font-semibold">Email</th>
              <th className="text-left px-4 py-3 font-semibold">Nazionalità</th>
              <th className="text-left px-4 py-3 font-semibold">Camera</th>
              <th className="text-left px-4 py-3 font-semibold">Struttura</th>
            </tr>
          </thead>
          <tbody>
            {filtered?.map((a: any, i: number) => (
              <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="border-b border-border/30 hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium">{a.studenti?.cognome} {a.studenti?.nome}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{a.studenti?.email}</td>
                <td className="px-4 py-3 text-sm">{a.studenti?.nazionalita || '-'}</td>
                <td className="px-4 py-3 text-sm">{a.camere?.numero || '-'}</td>
                <td className="px-4 py-3 text-sm">{a.camere?.strutture?.nome || '-'}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {filtered?.length === 0 && (
          <div className="py-12 text-center">
            <UsersIcon className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground">Nessun residente trovato</p>
          </div>
        )}
      </div>
    </div>
  );
}
