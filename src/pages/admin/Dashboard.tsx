import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import {
  FileText, Users, DoorOpen, Clock, ChevronRight, Inbox,
  ClipboardCheck, UserPlus, Wrench, CalendarClock, CheckCircle2,
} from 'lucide-react';
import { useStrutturaFilter } from '@/hooks/useStrutturaFilter';
import { StrutturaSelect } from '@/components/admin/StrutturaSelect';

export default function Dashboard() {
  const { strutturaId, setStrutturaId, strutture, nomeSelezionato, isAll } = useStrutturaFilter();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', strutturaId],
    queryFn: async () => {
      // Camere filtrate per struttura
      let camereQ = supabase.from('camere').select('id, stato, posti, struttura_id');
      if (!isAll) camereQ = camereQ.eq('struttura_id', strutturaId);
      const camere = await camereQ;
      const cameraIds = (camere.data ?? []).map((c: any) => c.id);

      // Candidature filtrate per struttura preferita
      let candQ = supabase.from('candidature').select('stato, struttura_preferita_id');
      if (!isAll) candQ = candQ.eq('struttura_preferita_id', strutturaId);
      const candidature = await candQ;

      // Studenti totali (non legati a struttura)
      const studenti = await supabase.from('studenti').select('id', { count: 'exact', head: true });

      // Assegnazioni attive nella struttura selezionata
      let postiOccupati = 0;
      if (isAll) {
        const r = await supabase.from('assegnazioni').select('id', { count: 'exact', head: true }).eq('stato', 'attiva');
        postiOccupati = r.count ?? 0;
      } else if (cameraIds.length > 0) {
        const r = await supabase.from('assegnazioni').select('id', { count: 'exact', head: true }).eq('stato', 'attiva').in('camera_id', cameraIds);
        postiOccupati = r.count ?? 0;
      }

      const cand = candidature.data || [];
      const cam = camere.data || [];
      const totalPosti = cam.reduce((s, c) => s + c.posti, 0);

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
    queryKey: ['recent-candidature', strutturaId],
    queryFn: async () => {
      let q = supabase
        .from('candidature')
        .select('id, stato, created_at, studenti(nome, cognome)')
        .order('created_at', { ascending: false })
        .limit(5);
      if (!isAll) q = q.eq('struttura_preferita_id', strutturaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ['admin-tasks', strutturaId],
    queryFn: async () => {
      const today = new Date();
      const in30 = new Date();
      in30.setDate(today.getDate() + 30);
      const todayIso = today.toISOString().slice(0, 10);
      const in30Iso = in30.toISOString().slice(0, 10);

      // Pre-fetch ID camere della struttura per filtrare conteggi assegnazioni
      let cameraIds: string[] | null = null;
      if (!isAll) {
        const { data: cams } = await supabase.from('camere').select('id').eq('struttura_id', strutturaId);
        cameraIds = (cams ?? []).map((c: any) => c.id);
      }
      const candFilter = (q: any) => isAll ? q : q.eq('struttura_preferita_id', strutturaId);
      const camereFilter = (q: any) => isAll ? q : q.eq('struttura_id', strutturaId);
      const assegnFilter = (q: any) => {
        if (isAll) return q;
        if (cameraIds && cameraIds.length > 0) return q.in('camera_id', cameraIds);
        return q.eq('camera_id', '00000000-0000-0000-0000-000000000000');
      };

      const [ricevute, valutazione, approvate, assegnAttive, manutenzione, scadenza] = await Promise.all([
        candFilter(supabase.from('candidature').select('id', { count: 'exact', head: true }).eq('stato', 'ricevuta')),
        candFilter(supabase.from('candidature').select('id', { count: 'exact', head: true }).eq('stato', 'in_valutazione')),
        candFilter(supabase.from('candidature').select('id').eq('stato', 'approvata')),
        assegnFilter(supabase.from('assegnazioni').select('candidatura_id').eq('stato', 'attiva')),
        camereFilter(supabase.from('camere').select('id', { count: 'exact', head: true }).eq('stato', 'manutenzione')),
        assegnFilter(supabase
          .from('assegnazioni')
          .select('id', { count: 'exact', head: true })
          .eq('stato', 'attiva')
          .not('data_fine', 'is', null)
          .gte('data_fine', todayIso)
          .lte('data_fine', in30Iso)),
      ]);

      const assegnate = new Set((assegnAttive.data ?? []).map((a: any) => a.candidatura_id));
      const daAssegnare = (approvate.data ?? []).filter((c: any) => !assegnate.has(c.id)).length;

      return {
        daPrendereInCarico: ricevute.count ?? 0,
        daDecidere: valutazione.count ?? 0,
        daAssegnare,
        manutenzione: manutenzione.count ?? 0,
        inScadenza: scadenza.count ?? 0,
      };
    },
  });

  const taskItems = [
    {
      key: 'ricevute',
      icon: Inbox,
      color: 'text-primary bg-primary/10',
      label: 'Candidature da prendere in carico',
      count: tasks?.daPrendereInCarico ?? 0,
      to: '/admin/candidature?stato=ricevuta',
    },
    {
      key: 'valutazione',
      icon: ClipboardCheck,
      color: 'text-warning bg-warning/10',
      label: 'Candidature in valutazione da decidere',
      count: tasks?.daDecidere ?? 0,
      to: '/admin/candidature?stato=in_valutazione',
    },
    {
      key: 'approvate',
      icon: UserPlus,
      color: 'text-success bg-success/10',
      label: 'Studenti approvati da assegnare a una camera',
      count: tasks?.daAssegnare ?? 0,
      to: '/admin/candidature?stato=approvata',
    },
    {
      key: 'manutenzione',
      icon: Wrench,
      color: 'text-muted-foreground bg-muted',
      label: 'Camere in manutenzione da riattivare',
      count: tasks?.manutenzione ?? 0,
      to: '/admin/camere?stato=manutenzione',
    },
    {
      key: 'scadenza',
      icon: CalendarClock,
      color: 'text-destructive bg-destructive/10',
      label: 'Soggiorni in scadenza nei prossimi 30 giorni',
      count: tasks?.inScadenza ?? 0,
      to: '/admin/residenti',
    },
  ].filter((t) => t.count > 0);

  const totalTasks = taskItems.reduce((s, t) => s + t.count, 0);

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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Home</h1>
          <p className="text-[13px] text-muted-foreground">
            {isAll
              ? 'Panoramica complessiva di tutte le strutture'
              : `Panoramica struttura ${nomeSelezionato ?? ''}`}
          </p>
        </div>
        <StrutturaSelect value={strutturaId} onChange={setStrutturaId} strutture={strutture} />
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

      {/* Task da svolgere */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-card border border-border/50 rounded-lg">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold">Task da svolgere</h2>
          {totalTasks > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {totalTasks}
            </span>
          )}
        </div>
        {taskItems.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-success/70 mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground">Nessuna task in sospeso 🎉</p>
          </div>
        ) : (
          <div className="divide-y">
            {taskItems.map((t) => (
              <Link
                key={t.key}
                to={t.to}
                className="px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.color}`}>
                  <t.icon className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium flex-1">{t.label}</p>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground">
                  {t.count}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </motion.div>

      {/* Occupazione */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border/50 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">
          {isAll ? 'Occupazione complessiva' : `Occupazione struttura ${nomeSelezionato ?? ''}`}
        </h2>
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
