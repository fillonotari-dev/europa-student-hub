import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { FileText, Users, DoorOpen, Clock } from 'lucide-react';

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [candidature, camere, studenti, assegnazioni] = await Promise.all([
        supabase.from('candidature').select('stato'),
        supabase.from('camere').select('stato, posti'),
        supabase.from('studenti').select('id', { count: 'exact', head: true }),
        supabase.from('assegnazioni').select('id', { count: 'exact', head: true }).eq('stato', 'attiva'),
      ]);

      const cand = candidature.data || [];
      const cam = camere.data || [];
      const totalPosti = cam.reduce((s, c) => s + c.posti, 0);
      const postiOccupati = assegnazioni.count || 0;

      return {
        candidatureRicevute: cand.filter(c => c.stato === 'ricevuta').length,
        candidatureInValutazione: cand.filter(c => c.stato === 'in_valutazione').length,
        candidatureApprovate: cand.filter(c => c.stato === 'approvata').length,
        candidatureTotali: cand.length,
        totalePosti: totalPosti,
        postiOccupati,
        postiLiberi: totalPosti - postiOccupati,
        totaleStudenti: studenti.count || 0,
        occupazione: totalPosti > 0 ? Math.round((postiOccupati / totalPosti) * 100) : 0,
      };
    },
  });

  const { data: recentCandidature } = useQuery({
    queryKey: ['recent-candidature'],
    queryFn: async () => {
      const { data } = await supabase
        .from('candidature')
        .select('id, stato, created_at, studenti(nome, cognome)')
        .order('created_at', { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const metrics = [
    { label: 'Candidature ricevute', value: stats?.candidatureRicevute ?? 0, icon: Clock, color: 'text-primary bg-primary/10' },
    { label: 'In valutazione', value: stats?.candidatureInValutazione ?? 0, icon: FileText, color: 'text-warning bg-warning/10' },
    { label: 'Posti liberi', value: stats?.postiLiberi ?? 0, icon: DoorOpen, color: 'text-success bg-success/10' },
    { label: 'Studenti registrati', value: stats?.totaleStudenti ?? 0, icon: Users, color: 'text-accent bg-accent/10' },
  ];

  const statoLabel: Record<string, string> = {
    ricevuta: 'Ricevuta',
    in_valutazione: 'In valutazione',
    approvata: 'Approvata',
    rifiutata: 'Rifiutata',
    ritirata: 'Ritirata',
    sostituita: 'Sostituita',
  };

  const statoColor: Record<string, string> = {
    ricevuta: 'bg-primary/10 text-primary',
    in_valutazione: 'bg-warning/10 text-warning',
    approvata: 'bg-success/10 text-success',
    rifiutata: 'bg-destructive/10 text-destructive',
    ritirata: 'bg-muted text-muted-foreground',
    sostituita: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-[13px] text-muted-foreground">Panoramica dello Studentato Europa</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${m.color}`}>
                <m.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{m.value}</p>
                <p className="text-[13px] text-muted-foreground">{m.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Occupazione */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border/50 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Occupazione struttura Turri</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-muted rounded-full h-3">
            <div className="bg-primary rounded-full h-3 transition-all" style={{ width: `${stats?.occupazione ?? 0}%` }} />
          </div>
          <span className="text-sm font-semibold">{stats?.occupazione ?? 0}%</span>
        </div>
        <p className="text-[13px] text-muted-foreground mt-2">
          {stats?.postiOccupati ?? 0} / {stats?.totalePosti ?? 0} posti occupati
        </p>
      </motion.div>

      {/* Recent candidature */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-card border border-border/50 rounded-lg">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold">Candidature recenti</h2>
        </div>
        <div className="divide-y">
          {recentCandidature?.map((c: any) => (
            <div key={c.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div>
                <p className="text-sm font-medium">{c.studenti?.nome} {c.studenti?.cognome}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString('it-IT')}</p>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statoColor[c.stato] || ''}`}>
                {statoLabel[c.stato] || c.stato}
              </span>
            </div>
          ))}
          {(!recentCandidature || recentCandidature.length === 0) && (
            <div className="px-4 py-8 text-center">
              <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-[13px] text-muted-foreground">Nessuna candidatura ricevuta</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
