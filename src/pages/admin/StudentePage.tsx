import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useCandidaturaActions, CandidaturaActionsContext } from '@/hooks/useCandidaturaActions';
import { CandidaturaDetail } from '@/components/admin/candidatura/CandidaturaDetail';
import { Section } from '@/components/admin/candidatura/Section';
import { User, ArrowLeft, DoorOpen, FileText, BedDouble } from 'lucide-react';
import { Button } from '@/components/ui/button';

const fmtIt = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString('it-IT') : '';

export default function StudentePage() {
  const { id: studenteId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const candidaturaParam = searchParams.get('candidatura');
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const { data: studente, isLoading: loadingStudente } = useQuery({
    queryKey: ['studente', studenteId],
    enabled: !!studenteId,
    queryFn: async () => {
      const { data } = await supabase.from('studenti').select('*').eq('id', studenteId).maybeSingle();
      return data;
    },
  });

  usePageTitle(studente ? `${studente.cognome ?? ''} ${studente.nome ?? ''}`.trim() : null);

  const { data: candidature } = useQuery({
    queryKey: ['studente-candidature', studenteId],
    enabled: !!studenteId,
    queryFn: async () => {
      const { data } = await supabase
        .from('candidature')
        .select('*, strutture(nome)')
        .eq('studente_id', studenteId)
        .order('created_at', { ascending: false });
      // Iniettiamo studenti inline così i componenti condivisi trovano quello che si aspettano.
      return (data ?? []).map((c: any) => ({ ...c, studenti: studente ?? null }));
    },
  });

  const { data: assegnazioni } = useQuery({
    queryKey: ['studente-assegnazioni', studenteId],
    enabled: !!studenteId,
    queryFn: async () => {
      const { data } = await supabase
        .from('assegnazioni')
        .select('id, posto, data_inizio, data_fine, stato, camere(numero, strutture(nome))')
        .eq('studente_id', studenteId)
        .order('data_inizio', { ascending: false });
      return data ?? [];
    },
  });

  const { data: assegnazioniAttive } = useQuery({
    queryKey: ['candidature-con-assegnazione-attiva'],
    queryFn: async () => {
      const { data } = await supabase.from('assegnazioni').select('candidatura_id').eq('stato', 'attiva');
      return new Set((data ?? []).map((a: any) => a.candidatura_id));
    },
  });

  const actions = useCandidaturaActions({
    candidatureConAssegnazione: assegnazioniAttive ?? null,
    extraInvalidateKeys: [
      ['studente', studenteId],
      ['studente-candidature', studenteId],
      ['studente-assegnazioni', studenteId],
    ],
  });

  // Highlight: parte solo quando i dati sono resi. Se l'id non appartiene o non esiste, nessuna azione.
  useEffect(() => {
    if (!candidature || !candidaturaParam) return;
    const exists = candidature.some((c: any) => c.id === candidaturaParam);
    if (!exists) return;
    setHighlightId(candidaturaParam);
    const el = document.getElementById(`candidatura-${candidaturaParam}`);
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    const t = setTimeout(() => setHighlightId(null), 1500);
    return () => clearTimeout(t);
  }, [candidature, candidaturaParam]);

  if (loadingStudente) {
    return <p className="text-muted-foreground">Caricamento...</p>;
  }

  if (!studente) {
    return (
      <div className="py-16 text-center">
        <User className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-[13px] text-muted-foreground">Persona non trovata</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/admin/candidature"><ArrowLeft className="w-4 h-4 mr-1" /> Torna alle candidature</Link>
        </Button>
      </div>
    );
  }

  const attiva = (assegnazioni ?? []).find((a: any) => a.stato === 'attiva');

  return (
    <CandidaturaActionsContext.Provider value={actions.ctxValue}>
      <div className="space-y-6">
        <Section title="Anagrafica" items={[
          ['Email', studente.email],
          ['Telefono', studente.telefono],
          ['Nazionalità', studente.nazionalita],
          ['Data di nascita', fmtIt(studente.data_nascita)],
          ['Codice fiscale', studente.codice_fiscale],
          ...(attiva ? [[
            'Attualmente',
            `Cam. ${attiva.camere?.numero ?? '-'} · ${attiva.camere?.strutture?.nome ?? ''} · dal ${fmtIt(attiva.data_inizio)}`,
          ] as [string, string]] : []),
        ]} />

        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Candidature
          </h2>
          {(candidature?.length ?? 0) === 0 ? (
            <div className="bg-card border border-border/50 rounded-lg py-10 text-center">
              <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-[13px] text-muted-foreground">Nessuna candidatura per questa persona</p>
            </div>
          ) : (
            <div className="space-y-4">
              {candidature!.map((c: any) => (
                <CandidaturaDetail key={c.id} candidatura={c} studenteId={studenteId} highlight={highlightId === c.id} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BedDouble className="w-4 h-4" /> Soggiorni
          </h2>
          {(assegnazioni?.length ?? 0) === 0 ? (
            <div className="bg-card border border-border/50 rounded-lg py-10 text-center">
              <DoorOpen className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-[13px] text-muted-foreground">Nessun soggiorno registrato</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {assegnazioni!.map((a: any) => {
                const inCorso = a.stato === 'attiva' && !a.data_fine;
                const start = a.data_inizio ? new Date(a.data_inizio) : null;
                const end = a.data_fine ? new Date(a.data_fine) : null;
                let durata = '';
                if (start) {
                  const to = end ?? new Date();
                  const days = Math.max(1, Math.round((to.getTime() - start.getTime()) / 86400000));
                  durata = days >= 30 ? `${Math.round(days / 30)} mesi` : `${days} giorni`;
                }
                return (
                  <li key={a.id} className="flex items-center justify-between text-[13px] bg-card border border-border/50 rounded px-3 py-2">
                    <span>
                      Cam. <strong>{a.camere?.numero ?? '-'}</strong> · {a.camere?.strutture?.nome ?? ''}
                    </span>
                    <span className="text-muted-foreground">
                      {fmtIt(a.data_inizio)} → {inCorso ? 'in corso' : fmtIt(a.data_fine)} · {a.stato} {durata && `· ${durata}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {actions.dialogs}
      </div>
    </CandidaturaActionsContext.Provider>
  );
}