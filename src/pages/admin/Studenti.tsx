import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Search, Users as UsersIcon } from 'lucide-react';

export default function Studenti() {
  const [search, setSearch] = useState('');

  const { data: studenti } = useQuery({
    queryKey: ['studenti'],
    queryFn: async () => {
      const { data } = await supabase.from('studenti').select('*').order('cognome');
      return data ?? [];
    },
  });

  const filtered = studenti?.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.nome.toLowerCase().includes(q) || s.cognome.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Studenti</h1>
        <p className="text-[13px] text-muted-foreground">Elenco degli studenti registrati</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Cerca studente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 text-[13px] text-muted-foreground">
              <th className="text-left px-4 py-3 font-medium">Nome</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Nazionalità</th>
              <th className="text-left px-4 py-3 font-medium">Università</th>
              <th className="text-left px-4 py-3 font-medium">Corso</th>
              <th className="text-left px-4 py-3 font-medium">Matricola</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered?.map((s, i) => (
              <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium">{s.cognome} {s.nome}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{s.email}</td>
                <td className="px-4 py-3 text-sm">{s.nazionalita || '-'}</td>
                <td className="px-4 py-3 text-sm">{s.universita || '-'}</td>
                <td className="px-4 py-3 text-sm">{s.corso_di_studi || '-'}</td>
                <td className="px-4 py-3 text-sm">{s.matricola || '-'}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {filtered?.length === 0 && (
          <div className="py-12 text-center">
            <UsersIcon className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground">Nessuno studente trovato</p>
          </div>
        )}
      </div>
    </div>
  );
}
