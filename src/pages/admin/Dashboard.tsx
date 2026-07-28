import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import {
  ChevronRight, Inbox, ClipboardCheck, UserPlus, Wrench, CalendarClock,
  CheckCircle2, AlertTriangle, MailCheck, DoorOpen, Users, ArrowRightCircle,
} from 'lucide-react';

/**
 * Home ricostruita in due blocchi:
 *  - "Da fare": azioni pendenti (arrivi da valutare, decisioni, esiti, ecc.)
 *  - "Stato dello studentato": metriche di occupazione per sede affiancate.
 * Il filtro sede globale non esiste più: qui si mostrano tutte le sedi in parallelo.
 */
export default function Dashboard() {
  const { data: strutture } = useQuery({
    queryKey: ['strutture-tutte'],
    queryFn: async () => {
      const { data } = await supabase.from('strutture').select('id, nome').order('nome');
      return data ?? [];
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: async () => {
      const today = new Date();
      const in30 = new Date(); in30.setDate(today.getDate() + 30);
      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(today.getDate() - 7);
      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(today.getDate() - 30);
      const nowIso = today.toISOString();
      const todayIso = today.toISOString().slice(0, 10);
      const in30Iso = in30.toISOString().slice(0, 10);

      const [
        daValutare, daDecidere, inAttesaPosto, manutenzione, scadenza,
        vecchie, tokenScaduti, manutVecchia, assegnScadute,
      ] = await Promise.all([
        supabase.from('candidature').select('id', { count: 'exact', head: true }).eq('stato', 'da_valutare'),
        supabase.from('candidature').select('id', { count: 'exact', head: true }).eq('stato', 'da_decidere'),
        supabase.from('candidature').select('id', { count: 'exact', head: true }).eq('stato', 'in_attesa_posto'),
        supabase.from('camere').select('id', { count: 'exact', head: true }).eq('stato', 'manutenzione'),
        supabase.from('assegnazioni').select('id', { count: 'exact', head: true }).eq('stato', 'attiva')
          .not('data_fine', 'is', null).gte('data_fine', todayIso).lte('data_fine', in30Iso),
        supabase.from('candidature').select('id', { count: 'exact', head: true })
          .eq('stato', 'da_valutare').lt('created_at', sevenDaysAgo.toISOString()),
        supabase.from('candidature').select('id', { count: 'exact', head: true })
          .eq('stato', 'in_attesa_studente').lt('token_scade_il', nowIso),
        supabase.from('camere').select('id', { count: 'exact', head: true })
          .eq('stato', 'manutenzione').lt('updated_at', thirtyDaysAgo.toISOString()),
        supabase.from('assegnazioni').select('id', { count: 'exact', head: true })
          .eq('stato', 'attiva').not('data_fine', 'is', null).lt('data_fine', todayIso),
      ]);

      return {
        daValutare: daValutare.count ?? 0,
        daDecidere: daDecidere.count ?? 0,
        inAttesaPosto: inAttesaPosto.count ?? 0,
        manutenzione: manutenzione.count ?? 0,
        inScadenza: scadenza.count ?? 0,
        vecchie: vecchie.count ?? 0,
        tokenScaduti: tokenScaduti.count ?? 0,
        manutVecchia: manutVecchia.count ?? 0,
        assegnScadute: assegnScadute.count ?? 0,
      };
    },
  });

  const { data: statoPerSede } = useQuery({
    queryKey: ['dashboard-stato-per-sede'],
    queryFn: async () => {
      const [camere, assegn] = await Promise.all([
        supabase.from('camere').select('id, posti, struttura_id, stato'),
        supabase.from('assegnazioni').select('camera_id, camere!inner(struttura_id)').eq('stato', 'attiva'),
      ]);
      const cam = camere.data ?? [];
      const ass = assegn.data ?? [];
      const bySede = new Map<string, { posti: number; occupati: number; manut: number }>();
      cam.forEach((c: any) => {
        const b = bySede.get(c.struttura_id) ?? { posti: 0, occupati: 0, manut: 0 };
        b.posti += c.posti;
        if (c.stato === 'manutenzione') b.manut += 1;
        bySede.set(c.struttura_id, b);
      });
      ass.forEach((a: any) => {
        const sid = a.camere?.struttura_id;
        if (!sid) return;
        const b = bySede.get(sid) ?? { posti: 0, occupati: 0, manut: 0 };
        b.occupati += 1;
        bySede.set(sid, b);
      });
      return bySede;
    },
  });

  const taskItems = [
    { key: 'valutare', icon: Inbox, color: 'text-primary bg-primary/10',
      label: 'Candidature da valutare', count: tasks?.daValutare ?? 0,
      to: '/admin/candidature?stadio=da_valutare' },
    { key: 'decidere', icon: ClipboardCheck, color: 'text-warning bg-warning/10',
      label: 'Candidature complete in attesa di decisione', count: tasks?.daDecidere ?? 0,
      to: '/admin/candidature?stadio=da_decidere' },
    { key: 'attesa-posto', icon: UserPlus, color: 'text-success bg-success/10',
      label: 'Studenti accolti in lista d\'attesa da assegnare', count: tasks?.inAttesaPosto ?? 0,
      to: '/admin/candidature?stadio=in_attesa_posto' },
    { key: 'manutenzione', icon: Wrench, color: 'text-muted-foreground bg-muted',
      label: 'Camere in manutenzione', count: tasks?.manutenzione ?? 0,
      to: '/admin/camere?stato=manutenzione' },
    { key: 'scadenza', icon: CalendarClock, color: 'text-accent-foreground bg-accent/20',
      label: 'Soggiorni in scadenza nei prossimi 30 giorni', count: tasks?.inScadenza ?? 0,
      to: '/admin/residenti' },
  ].filter(t => t.count > 0);

  const attentionItems = [
    { key: 'vecchie', icon: AlertTriangle, color: 'text-destructive bg-destructive/10',
      label: 'Candidature ricevute da più di 7 giorni senza presa in carico',
      count: tasks?.vecchie ?? 0, to: '/admin/candidature?stadio=da_valutare' },
    { key: 'link-scaduti', icon: AlertTriangle, color: 'text-destructive bg-destructive/10',
      label: 'Link form completo scaduti senza compilazione',
      count: tasks?.tokenScaduti ?? 0, to: '/admin/candidature?stadio=in_attesa_studente' },
    { key: 'manut-vecchia', icon: Wrench, color: 'text-warning bg-warning/10',
      label: 'Camere in manutenzione da più di 30 giorni',
      count: tasks?.manutVecchia ?? 0, to: '/admin/camere?stato=manutenzione' },
    { key: 'assegn-scadute', icon: AlertTriangle, color: 'text-destructive bg-destructive/10',
      label: 'Soggiorni con data fine passata da chiudere',
      count: tasks?.assegnScadute ?? 0, to: '/admin/residenti' },
  ].filter(t => t.count > 0);

  const totalTasks = taskItems.reduce((s, t) => s + t.count, 0);
  const totalAttention = attentionItems.reduce((s, t) => s + t.count, 0);

  return (
    <div className="space-y-6">
      {/* Da fare */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/50 rounded-lg">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold">Da fare</h2>
          {totalTasks > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{totalTasks}</span>
          )}
        </div>
        {taskItems.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-success/70 mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground">Nulla in sospeso 🎉</p>
          </div>
        ) : (
          <div className="divide-y">
            {taskItems.map(t => (
              <Link key={t.key} to={t.to}
                className="px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.color}`}>
                  <t.icon className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium flex-1">{t.label}</p>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground">{t.count}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </motion.div>

      {/* Richiede attenzione */}
      {attentionItems.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-destructive/30 rounded-lg">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" /> Richiede attenzione
            </h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{totalAttention}</span>
          </div>
          <div className="divide-y">
            {attentionItems.map(t => (
              <Link key={t.key} to={t.to}
                className="px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.color}`}>
                  <t.icon className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium flex-1">{t.label}</p>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground">{t.count}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stato dello studentato: metriche per sede affiancate */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/50 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-4">Stato dello studentato</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(strutture ?? []).map((s: any) => {
            const b = statoPerSede?.get(s.id) ?? { posti: 0, occupati: 0, manut: 0 };
            const pct = b.posti > 0 ? Math.round((b.occupati / b.posti) * 100) : 0;
            return (
              <div key={s.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{s.nome}</p>
                  <Link to={`/admin/residenti?sede=${s.id}`} className="text-[12px] text-primary inline-flex items-center gap-1 hover:underline">
                    Vai <ArrowRightCircle className="w-3 h-3" />
                  </Link>
                </div>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric icon={Users} label="Occupati" value={b.occupati} />
                  <Metric icon={DoorOpen} label="Liberi" value={Math.max(0, b.posti - b.occupati)} />
                  <Metric icon={Wrench} label="Manut." value={b.manut} />
                </div>
                <p className="text-[12px] text-muted-foreground text-center">
                  {b.occupati}/{b.posti} posti occupati · {pct}%
                </p>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded bg-muted/40 py-2">
      <Icon className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}