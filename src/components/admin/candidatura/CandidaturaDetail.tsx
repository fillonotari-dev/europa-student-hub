import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { Section } from './Section';
import { DocumentoRow } from './DocumentoRow';
import { CandidaturaBadges } from './CandidaturaBadges';
import { formatStatoCandidatura } from '@/lib/statoCandidatura';

const TIPO_STUDENTE_LABELS: Record<string, string> = {
  universitario: 'Corso di laurea', erasmus: 'Erasmus o scambio', master: 'Master o dottorato', altro: 'Altro',
};
const COME_CONOSCIUTO_LABELS: Record<string, string> = {
  instagram: 'Instagram', google: 'Google', universita: 'Università', esn: 'ESN',
  amici: 'Amici', sito: 'Sito web', altro: 'Altro',
};
const ORARI_LABELS: Record<string, string> = {
  mattiniero: 'Si sveglia presto', serale: 'Fa tardi la sera', variabile: 'Dipende dai giorni',
};
const PERSONALITA_LABELS: Record<string, string> = {
  tranquilla: 'Persona tranquilla', socievole: 'Persona socievole', riservata: 'Persona riservata', altro: 'Altro',
};
const ORDINE_LABELS: Record<string, string> = {
  molto: 'Rimette tutto a posto subito', abbastanza: 'Rimette a posto, ma non sempre subito', poco: 'Tende a lasciare le cose in giro',
};
const fmtIt = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString('it-IT') : '';
const fmtItDateTime = (v: string | null | undefined) => v ? new Date(v).toLocaleString('it-IT') : '';
const fmtPeriodo = (a: string | null | undefined, b: string | null | undefined) => {
  if (!a && !b) return '';
  return `${fmtIt(a) || '—'} → ${fmtIt(b) || '—'}`;
};

export function CandidaturaDetail({ candidatura, highlight, studenteId, open, onToggle }: {
  candidatura: any;
  highlight?: boolean;
  studenteId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [savedFlash, setSavedFlash] = useState(false);

  const { data: documenti } = useQuery({
    queryKey: ['studente-documenti', studenteId, candidatura.id],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from('documenti').select('*').eq('candidatura_id', candidatura.id);
      return data ?? [];
    },
  });

  const { data: log } = useQuery({
    queryKey: ['studente-log', studenteId, candidatura.id],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from('log_stato_candidature')
        .select('*')
        .eq('candidatura_id', candidatura.id)
        .order('created_at', { ascending: true });
      return data ?? [];
    },
  });

  const c = candidatura;

  const firstLogId = useMemo(() => (log && log.length > 0 ? log[0].id : null), [log]);

  return (
    <motion.section
      id={`candidatura-${c.id}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border rounded-lg transition-shadow ${highlight ? 'ring-2 ring-primary/40 border-primary/30' : 'border-border/50'}`}
    >
      <header className="flex items-start justify-between gap-3 flex-wrap p-5 pb-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-start gap-2 text-left flex-1 min-w-0"
          aria-expanded={open}
        >
          {open
            ? <ChevronDown className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />}
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Candidatura del {new Date(c.created_at).toLocaleDateString('it-IT')} · {c.anno_accademico ?? '—'}
            </p>
            <CandidaturaBadges c={c} />
          </div>
        </button>
      </header>

      {open && (
      <div className="px-5 pb-5 space-y-5">
      <Section title="Documento presentato" items={[
        ['N. documento identità', c.documento_identita_n],
      ]} />

      <Section title="Dati accademici" items={[
        ['Università', c.universita_snapshot],
        ['Corso', c.corso_snapshot],
        ['Anno', c.anno_corso_snapshot],
        ['Matricola', c.matricola_snapshot],
        ['Tipo studente', c.tipo_studente === 'altro'
          ? (c.tipo_studente_altro || 'Altro')
          : (TIPO_STUDENTE_LABELS[c.tipo_studente] || c.tipo_studente)],
      ]} />

      <Section title="Preferenze" items={[
        ['Struttura', c.strutture?.nome || '-'],
        ['Tipo camera', c.tipo_camera_preferito || '-'],
        ['Periodo', fmtPeriodo(c.periodo_inizio, c.periodo_fine)],
        ['Anno acc.', c.anno_accademico],
        ['Data arrivo prevista', fmtIt(c.data_arrivo_prevista)],
        ['Come ci ha conosciuti', c.come_conosciuto === 'altro'
          ? (c.come_conosciuto_altro || 'Altro')
          : (COME_CONOSCIUTO_LABELS[c.come_conosciuto] || c.come_conosciuto)],
        ['Note preferenze', c.preferenze_note],
      ]} />

      {c.versione_form === 'completa' && (
        <Section title="Stile di vita" items={[
          ['Lingue parlate', c.lingue_parlate],
          ['Orari', ORARI_LABELS[c.orari] || c.orari],
          ['Personalità', c.personalita === 'altro'
            ? (c.personalita_altro || 'Altro')
            : (PERSONALITA_LABELS[c.personalita] || c.personalita)],
          ['Ordine/pulizia', ORDINE_LABELS[c.ordine_pulizia] || c.ordine_pulizia],
          ['Fumatore', c.fumatore === true ? 'Sì' : c.fumatore === false ? 'No' : ''],
          ['Presentazione', c.presentazione],
        ]} />
      )}

      {(c.garante_nome || c.garante_telefono || c.garante_email) && (
        <Section title="Garante" items={[
          ['Nome', c.garante_nome],
          ['Relazione', c.garante_relazione],
          ['Telefono', c.garante_telefono],
          ['Email', c.garante_email],
        ]} />
      )}

      <Section title="Stato form" items={[
        ['Versione', c.versione_form === 'completa' ? 'Completa' : 'Pre-screening'],
        ['Completato il', fmtItDateTime(c.completata_il)],
        ['Dichiarazioni firmate il', fmtItDateTime(c.dichiarazioni?.firmate_il)],
      ]} />

      {c.messaggio && (
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-[11px] font-medium text-muted-foreground mb-1">Messaggio</p>
          <p className="text-sm whitespace-pre-wrap">{c.messaggio}</p>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold mb-2">Documenti caricati</p>
        {documenti && documenti.length > 0 ? (
          <div className="space-y-2">
            {documenti.map((d: any) => <DocumentoRow key={d.id} doc={d} />)}
          </div>
        ) : (
          <div className="bg-muted/30 rounded-lg p-3 text-[13px] text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" /> Nessun documento caricato
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Cronologia stati</p>
        {(log?.length ?? 0) === 0 ? (
          <div className="bg-muted/30 rounded-lg p-3 text-[13px] text-muted-foreground">Nessun cambio di stato registrato</div>
        ) : (
          <ol className="relative border-l border-border/60 pl-4 space-y-3">
            {log!.map((l: any) => {
              const isFirst = l.id === firstLogId;
              const isTransition = !isFirst && !!l.stato_precedente && l.stato_precedente !== l.stato_nuovo;
              const hasNote = !!(l.note && String(l.note).trim());
              let title: React.ReactNode;
              if (isFirst) {
                title = l.stato_nuovo === 'da_valutare'
                  ? <>Candidatura ricevuta</>
                  : <>Candidatura registrata come <strong>{formatStatoCandidatura(l.stato_nuovo)}</strong></>;
              } else if (isTransition) {
                title = <>Stato passato da <strong>{formatStatoCandidatura(l.stato_precedente)}</strong> a <strong>{formatStatoCandidatura(l.stato_nuovo)}</strong></>;
              } else if (hasNote) {
                title = <span className="whitespace-pre-wrap">{l.note}</span>;
              } else {
                title = <>Stato registrato: <strong>{formatStatoCandidatura(l.stato_nuovo)}</strong></>;
              }
              const showNoteBelow = hasNote && (isFirst || isTransition);
              return (
                <li key={l.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary/60 border-2 border-background" />
                  <div className="text-[13px]">{title}</div>
                  {showNoteBelow && (
                    <div className="text-[12px] text-muted-foreground mt-0.5 whitespace-pre-wrap">{l.note}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(l.created_at).toLocaleString('it-IT')}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-semibold">Note admin</p>
          {savedFlash && (
            <span className="inline-flex items-center gap-1 text-[11px] text-success">
              <CheckCircle2 className="w-3 h-3" /> Salvato
            </span>
          )}
        </div>
        <Textarea
          defaultValue={c.note_admin || ''}
          placeholder="Note interne..."
          onBlur={e => {
            const val = e.target.value;
            if (val !== (c.note_admin || '')) {
              supabase.from('candidature').update({ note_admin: val }).eq('id', c.id).then(({ error }) => {
                if (error) {
                  toast({ title: 'Errore', description: 'Nota non salvata', variant: 'destructive' });
                } else {
                  queryClient.invalidateQueries({ queryKey: ['candidature'] });
                  queryClient.invalidateQueries({ queryKey: ['studente-candidature', studenteId] });
                  toast({ title: 'Nota salvata' });
                  setSavedFlash(true);
                  setTimeout(() => setSavedFlash(false), 2000);
                }
              });
            }
          }}
        />
      </div>
      </div>
      )}
    </motion.section>
  );
}