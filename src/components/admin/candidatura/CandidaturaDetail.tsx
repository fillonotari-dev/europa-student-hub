import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, CheckCircle2 } from 'lucide-react';
import { Section } from './Section';
import { DocumentoRow } from './DocumentoRow';
import { CandidaturaBadges } from './CandidaturaBadges';
import { CandidaturaActions } from '@/components/admin/CandidaturaActions';
import { formatStato } from '@/lib/statoCandidatura';

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

export function CandidaturaDetail({ candidatura, highlight, studenteId }: {
  candidatura: any;
  highlight?: boolean;
  studenteId: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [savedFlash, setSavedFlash] = useState(false);

  const { data: documenti } = useQuery({
    queryKey: ['studente-documenti', studenteId, candidatura.id],
    queryFn: async () => {
      const { data } = await supabase.from('documenti').select('*').eq('candidatura_id', candidatura.id);
      return data ?? [];
    },
  });

  const { data: log } = useQuery({
    queryKey: ['studente-log', studenteId, candidatura.id],
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
  const s = c.studenti ?? {};

  return (
    <motion.section
      id={`candidatura-${c.id}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border rounded-lg p-5 space-y-5 transition-shadow ${highlight ? 'ring-2 ring-primary/40 border-primary/30' : 'border-border/50'}`}
    >
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Candidatura del {new Date(c.created_at).toLocaleDateString('it-IT')} · {c.anno_accademico ?? '—'}
          </p>
          <CandidaturaBadges c={c} />
        </div>
      </header>

      <Section title="Dati studente" items={[
        ['Email', s.email],
        ['Telefono', s.telefono],
        ['Nazionalità', s.nazionalita],
        ['Data di nascita', fmtIt(s.data_nascita)],
        ['Codice fiscale', s.codice_fiscale],
        ['Indirizzo residenza', c.indirizzo_residenza],
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
        ['Periodo', `${c.periodo_inizio || ''} → ${c.periodo_fine || ''}`],
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
          <ol className="space-y-1.5">
            {log!.map((l: any) => (
              <li key={l.id} className="flex items-center justify-between text-[13px] bg-muted/30 rounded px-3 py-1.5">
                <span>
                  {l.stato_precedente ? <><span className="text-muted-foreground">{formatStato(l.stato_precedente)}</span> → </> : null}
                  <strong>{formatStato(l.stato_nuovo)}</strong>
                </span>
                <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString('it-IT')}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Azioni</p>
        <CandidaturaActions.Buttons candidatura={c} />
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
    </motion.section>
  );
}