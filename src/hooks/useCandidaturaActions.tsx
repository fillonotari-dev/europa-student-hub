import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { MailCheck, Copy, CheckCircle, Mail, AlertTriangle } from 'lucide-react';
import {
  type CandidaturaActionId, type CandidaturaLike,
} from '@/lib/candidaturaActions';

type Ctx = {
  trigger: (id: CandidaturaActionId, c: CandidaturaLike) => void;
  hasAssegnazioneAttiva: (c: CandidaturaLike) => boolean;
  haAvutoAssegnazione: (c: CandidaturaLike) => boolean;
};

const CandidaturaActionsContext = createContext<Ctx | null>(null);

export function useCandidaturaActionsCtx(): Ctx {
  const ctx = useContext(CandidaturaActionsContext);
  if (!ctx) throw new Error('CandidaturaActionsContext non montato: istanzia useCandidaturaActions() a livello di pagina.');
  return ctx;
}

interface Options {
  studentiHaAvutoAssegnazione?: Set<string> | null;
  studentiHaAssegnazioneAttiva?: Set<string> | null;
  extraInvalidateKeys?: readonly (readonly unknown[])[];
  onDeleted?: (c: CandidaturaLike) => void;
}

type AssignMode = 'assegna' | 'rinnova' | 'nuovo';

const todayIso = () => new Date().toISOString().split('T')[0];
const addDaysIso = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
};

export function useCandidaturaActions(options: Options = {}) {
  const {
    studentiHaAvutoAssegnazione,
    studentiHaAssegnazioneAttiva,
    extraInvalidateKeys,
    onDeleted,
  } = options;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const hasAssegnazioneAttiva = useCallback(
    (c: CandidaturaLike) => !!studentiHaAssegnazioneAttiva?.has(c.id),
    [studentiHaAssegnazioneAttiva],
  );
  const haAvutoAssegnazione = useCallback(
    (c: CandidaturaLike) => !!studentiHaAvutoAssegnazione?.has(c.id),
    [studentiHaAvutoAssegnazione],
  );

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['candidature'] });
    queryClient.invalidateQueries({ queryKey: ['studenti-approvati'] });
    queryClient.invalidateQueries({ queryKey: ['stadio'] });
    queryClient.invalidateQueries({ queryKey: ['residenti'] });
    queryClient.invalidateQueries({ queryKey: ['assegnazioni-attive'] });
    queryClient.invalidateQueries({ queryKey: ['assegnazioni-any'] });
    queryClient.invalidateQueries({ queryKey: ['camere'] });
    queryClient.invalidateQueries({ queryKey: ['camere-disp'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    for (const k of extraInvalidateKeys ?? []) {
      queryClient.invalidateQueries({ queryKey: k as unknown[] });
    }
  }, [queryClient, extraInvalidateKeys]);

  // ---- Mutazioni ---------------------------------------------------------

  const updateStato = useMutation({
    mutationFn: async ({ id, stato, patch }: { id: string; stato: string; patch?: Record<string, any> }) => {
      const { error } = await supabase.from('candidature')
        .update({ stato, ...(patch ?? {}) }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: 'Stato aggiornato' }); },
    onError: (e: any) => toast({ title: 'Errore', description: e?.message ?? 'Aggiornamento fallito', variant: 'destructive' }),
  });

  const setPriorita = useMutation({
    mutationFn: async ({ id, priorita }: { id: string; priorita: number | null }) => {
      const { error } = await supabase.from('candidature')
        .update({ stato: 'in_attesa_posto', priorita }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Aggiunto in lista d\'attesa' });
      setPrioritaTarget(null);
    },
    onError: (e: any) => toast({ title: 'Errore', description: e?.message, variant: 'destructive' }),
  });

  const annullaAssegnazione = useMutation({
    mutationFn: async (c: CandidaturaLike) => {
      // Puntuale sull'assegnazione: la maybeSingle() sui candidatura_id
      // rompeva i rinnovi (piu' assegnazioni sulla stessa candidatura).
      let assegnazioneId = c.assegnazione_id ?? null;
      let dataInizio: string | null = null;
      if (assegnazioneId) {
        const { data: att, error } = await supabase
          .from('assegnazioni').select('id, data_inizio, stato')
          .eq('id', assegnazioneId).maybeSingle();
        if (error) throw error;
        if (!att || att.stato !== 'attiva') throw new Error("L'assegnazione non risulta attiva.");
        dataInizio = att.data_inizio;
      } else {
        // Fallback: candidatura senza assegnazione_id in memoria (percorsi legacy).
        const { data: rows, error } = await supabase
          .from('assegnazioni').select('id, data_inizio').eq('candidatura_id', c.id).eq('stato', 'attiva');
        if (error) throw error;
        if (!rows || rows.length === 0) throw new Error('Nessuna assegnazione attiva da annullare.');
        if (rows.length > 1) throw new Error('Piu\' assegnazioni attive: aprire la scheda per selezionare.');
        assegnazioneId = rows[0].id;
        dataInizio = rows[0].data_inizio;
      }
      if (dataInizio && new Date(dataInizio) <= new Date()) {
        throw new Error('Il soggiorno e\' gia\' iniziato: concludilo dalla pagina Residenti.');
      }
      const { error: delErr } = await supabase.from('assegnazioni').delete().eq('id', assegnazioneId);
      if (delErr) throw delErr;
      const { error: updErr } = await supabase.from('candidature')
        .update({ stato: 'da_decidere', esito_email_inviata_il: null, esito_email_nota: null })
        .eq('id', c.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Assegnazione annullata', description: 'La candidatura torna in "Da decidere".' });
      setAnnullaTarget(null);
    },
    onError: (e: any) => toast({ title: 'Errore', description: e?.message, variant: 'destructive' }),
  });

  // ---- Trasferisci / Concludi soggiorno ---------------------------------

  const trasferisci = useMutation({
    mutationFn: async (v: {
      assegnazione_id: string; studente_id: string; vecchia_camera_id: string;
      nuova_camera_id: string; nuova_data_inizio: string; nuova_data_fine: string;
    }) => {
      if (v.nuova_camera_id === v.vecchia_camera_id) {
        throw new Error('La camera di destinazione coincide con quella attuale.');
      }
      const { data: disp, error: dispErr } = await supabase.rpc('camere_disponibilita', {
        p_dal: v.nuova_data_inizio, p_al: v.nuova_data_fine, p_struttura_id: null,
      });
      if (dispErr) throw dispErr;
      const row = (disp ?? []).find((r: any) => r.camera_id === v.nuova_camera_id);
      if (!row) throw new Error('Camera non trovata.');
      const occupati: number[] = row.posti_occupati_numeri ?? [];
      let nextPosto = 0;
      for (let p = 1; p <= row.posti; p++) if (!occupati.includes(p)) { nextPosto = p; break; }
      if (nextPosto === 0) throw new Error('La camera non ha posti liberi nel periodo scelto.');
      const { data: lastCand } = await supabase
        .from('candidature').select('id').eq('studente_id', v.studente_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!lastCand) throw new Error('Nessuna candidatura trovata per lo studente.');
      const inizio = new Date(v.nuova_data_inizio + 'T00:00:00Z');
      const chiusuraStr = new Date(inizio.getTime() - 86400000).toISOString().split('T')[0];
      const { error: updErr } = await supabase.from('assegnazioni')
        .update({ stato: 'conclusa', data_fine: chiusuraStr, motivo_chiusura: 'trasferimento' })
        .eq('id', v.assegnazione_id);
      if (updErr) throw updErr;
      const { error: insErr } = await supabase.from('assegnazioni').insert({
        camera_id: v.nuova_camera_id, studente_id: v.studente_id, candidatura_id: lastCand.id,
        posto: nextPosto, data_inizio: v.nuova_data_inizio, data_fine: v.nuova_data_fine, stato: 'attiva',
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Trasferimento completato' });
      setTransferTarget(null); setTransferCameraId('');
    },
    onError: (e: any) => toast({ title: 'Errore', description: e?.message, variant: 'destructive' }),
  });

  const concludi = useMutation({
    mutationFn: async (v: { assegnazione_id: string; data: string; note: string; motivo: string }) => {
      if (!v.motivo) throw new Error('Seleziona un motivo di chiusura.');
      const { error } = await supabase.from('assegnazioni')
        .update({ stato: 'conclusa', data_fine: v.data, note: v.note || null, motivo_chiusura: v.motivo })
        .eq('id', v.assegnazione_id);
      if (error) throw error;
      // Il contratto collegato non si accorge della conclusione: se ce n'è uno
      // attivo lo proponiamo (non lo imponiamo) in chiusura.
      if (v.motivo === 'trasferimento') return null;
      const { data: contratto } = await supabase
        .from('contratti')
        .select('id, data_inizio, data_fine, stato')
        .eq('assegnazione_id', v.assegnazione_id)
        .eq('stato', 'attivo')
        .maybeSingle();
      if (!contratto) return null;
      return { contratto, data: v.data, motivoAssegnazione: v.motivo };
    },
    onSuccess: (res) => {
      invalidateAll();
      toast({ title: 'Soggiorno concluso' });
      setEndTarget(null); setEndNote(''); setEndMotivo('');
      if (res) setContrattoProposta(res as any);
    },
    onError: (e: any) => toast({ title: 'Errore', description: e?.message, variant: 'destructive' }),
  });

  const chiudiContratto = useMutation({
    mutationFn: async (v: { contratto_id: string; data: string; motivo: string }) => {
      const { data, error } = await supabase.rpc('chiudi_contratto', {
        p_contratto_id: v.contratto_id, p_data_fine: v.data, p_motivo: v.motivo,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (annullate) => {
      queryClient.invalidateQueries({ queryKey: ['contratti'] });
      toast({
        title: 'Contratto chiuso',
        description: (annullate ?? 0) > 0 ? `Annullate ${annullate} mensilità successive al mese di chiusura.` : undefined,
      });
      setContrattoProposta(null);
    },
    onError: (e: any) => toast({ title: 'Errore', description: e?.message, variant: 'destructive' }),
  });

  const deleteCandidatura = useMutation({
    mutationFn: async (c: CandidaturaLike) => {
      // La pulizia dei documenti richiede service-role: non facciamo lo storage
      // remove dal client (i buckets sono chiusi al pubblico). L'edge function
      // valida ruolo admin, cancella file + righe DB, e verifica il bucket.
      const { data, error } = await supabase.functions.invoke('delete-candidatura', {
        body: { candidatura_id: c.id },
      });
      if (error) {
        let msg = error.message;
        try {
          const txt = await (error as any).context?.response?.text();
          if (txt) { const j = JSON.parse(txt); if (j?.error) msg = j.error; }
        } catch {}
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return c;
    },
    onSuccess: (c) => {
      invalidateAll();
      toast({ title: 'Candidatura eliminata', description: 'Documenti rimossi dallo storage.' });
      setDeleteTarget(null);
      onDeleted?.(c);
    },
    onError: (e: any) => {
      const map: Record<string, string> = {
        assegnazione_collegata: 'Impossibile eliminare: esiste un\'assegnazione collegata.',
        storage_cleanup_failed: 'Alcuni documenti non sono stati rimossi. Contatta il supporto.',
        forbidden: 'Non hai i permessi.',
        candidatura_non_trovata: 'Candidatura non trovata.',
      };
      toast({ title: 'Errore', description: map[e?.message] ?? (e?.message ?? 'Eliminazione fallita'), variant: 'destructive' });
    },
  });

  const sendEsito = useMutation({
    mutationFn: async ({ id, nota }: { id: string; nota: string }) => {
      const { data, error } = await supabase.functions.invoke('send-esito-email', {
        body: { candidatura_id: id, nota: nota || null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Comunicazione esito inviata' });
      setEsitoTarget(null);
      setEsitoNota('');
    },
    onError: (e: any) => toast({ title: 'Errore', description: e?.message ?? 'Invio fallito', variant: 'destructive' }),
    onSettled: () => setEsitoLoading(false),
  });

  // ---- Rifiuta (con nota + invio esito automatico) ----------------------

  const rifiutaMut = useMutation({
    mutationFn: async ({ c, nota }: { c: CandidaturaLike; nota: string }) => {
      const { error } = await supabase.from('candidature')
        .update({ stato: 'rifiutata' }).eq('id', c.id);
      if (error) throw error;
      // Best-effort invio email: se fallisce, lo stato resta rifiutata e
      // l'operatore vede l'azione "Reinvia esito" nel menu.
      try {
        const { data, error: sendErr } = await supabase.functions.invoke('send-esito-email', {
          body: { candidatura_id: c.id, nota: nota || null },
        });
        if (sendErr) throw sendErr;
        if ((data as any)?.error) throw new Error((data as any).error);
        return { emailInviata: true };
      } catch (e: any) {
        console.warn('rifiuta: invio esito fallito', e);
        return { emailInviata: false, err: e?.message };
      }
    },
    onSuccess: (res) => {
      invalidateAll();
      if (res.emailInviata) toast({ title: 'Candidatura rifiutata', description: 'Email di esito inviata.' });
      else toast({ title: 'Candidatura rifiutata', description: 'Invio esito non riuscito: riprova da "Reinvia esito".', variant: 'destructive' });
      setRifiutaTarget(null); setRifiutaNota('');
    },
    onError: (e: any) => toast({ title: 'Errore', description: e?.message, variant: 'destructive' }),
  });

  // ---- Assegna/Rinnova/Nuovo soggiorno ----------------------------------

  const assegnaSoggiorno = useMutation({
    mutationFn: async (v: {
      mode: AssignMode; c: CandidaturaLike;
      camera_id: string; posto: number; data_inizio: string; data_fine: string;
      studente_id: string; nota_esito: string;
    }) => {
      if (!v.data_inizio || !v.data_fine) throw new Error('Date obbligatorie.');
      if (v.data_fine < v.data_inizio) throw new Error('Data fine precedente alla data inizio.');

      // Verifica finale disponibilita' (safety net contro race)
      const { data: disp, error: dispErr } = await supabase.rpc('camere_disponibilita', {
        p_dal: v.data_inizio, p_al: v.data_fine, p_struttura_id: null,
      });
      if (dispErr) throw dispErr;
      const row = (disp ?? []).find((r: any) => r.camera_id === v.camera_id);
      if (!row) throw new Error('Camera non trovata.');
      const occupati: number[] = row.posti_occupati_numeri ?? [];
      if (occupati.includes(v.posto)) throw new Error('Il posto scelto e\' gia\' occupato nel periodo.');

      let candidaturaIdPerAssegnazione = v.c.id;

      // Nuovo soggiorno: creo una candidatura "interna" collegata allo studente.
      if (v.mode === 'nuovo') {
        const { data: newCand, error: newErr } = await supabase.from('candidature').insert({
          studente_id: v.studente_id,
          stato: 'accolta',
          versione_form: 'interna',
          periodo_inizio: v.data_inizio,
          periodo_fine: v.data_fine,
          note_admin: v.nota_esito || null,
        }).select('id').single();
        if (newErr) throw newErr;
        candidaturaIdPerAssegnazione = newCand.id;
      }

      // 1. Insert assegnazione
      const { data: insData, error: insErr } = await supabase.from('assegnazioni').insert({
        camera_id: v.camera_id, studente_id: v.studente_id,
        candidatura_id: candidaturaIdPerAssegnazione,
        posto: v.posto, data_inizio: v.data_inizio, data_fine: v.data_fine, stato: 'attiva',
      }).select('id').single();
      if (insErr) throw insErr;

      // 2. Update candidatura -> accolta (solo per assegna/rinnova; nuovo e' gia' accolta)
      if (v.mode === 'assegna' || v.mode === 'rinnova') {
        const { error: updErr } = await supabase.from('candidature')
          .update({ stato: 'accolta' }).eq('id', v.c.id);
        if (updErr) {
          // Rollback: elimino l'assegnazione appena creata per non lasciare
          // uno stato incoerente (assegnazione senza candidatura accolta).
          await supabase.from('assegnazioni').delete().eq('id', insData.id);
          throw new Error('Impossibile aggiornare lo stato candidatura. Assegnazione annullata. Dettaglio: ' + updErr.message);
        }
      }

      // 3. Email esito (solo assegna). Rinnova/nuovo non mandano email.
      if (v.mode === 'assegna') {
        try {
          const { error: mailErr } = await supabase.functions.invoke('send-esito-email', {
            body: { candidatura_id: v.c.id, nota: v.nota_esito || null },
          });
          if (mailErr) throw mailErr;
          return { emailInviata: true };
        } catch (e: any) {
          console.warn('assegna: invio esito fallito', e);
          return { emailInviata: false };
        }
      }
      return { emailInviata: false };
    },
    onSuccess: (res, vars) => {
      invalidateAll();
      const titles: Record<AssignMode, string> = {
        assegna: 'Posto assegnato', rinnova: 'Soggiorno rinnovato', nuovo: 'Nuovo soggiorno creato',
      };
      const desc = vars.mode === 'assegna'
        ? (res.emailInviata ? 'Email di esito inviata.' : 'Invio esito non riuscito: riprova da "Reinvia esito".')
        : undefined;
      toast({ title: titles[vars.mode], description: desc, variant: vars.mode === 'assegna' && !res.emailInviata ? 'destructive' : undefined });
      closeAssign();
    },
    onError: (e: any) => toast({ title: 'Errore', description: e?.message, variant: 'destructive' }),
  });

  // ---- Stato dialog ------------------------------------------------------

  const [deleteTarget, setDeleteTarget] = useState<CandidaturaLike | null>(null);
  const [statoConfirm, setStatoConfirm] = useState<{ c: CandidaturaLike; nextStato: string } | null>(null);
  const [regenConfirm, setRegenConfirm] = useState<CandidaturaLike | null>(null);
  const [linkTarget, setLinkTarget] = useState<CandidaturaLike | null>(null);
  const [linkData, setLinkData] = useState<{ url: string; scade_il: string } | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [esitoTarget, setEsitoTarget] = useState<CandidaturaLike | null>(null);
  const [esitoNota, setEsitoNota] = useState('');
  const [esitoLoading, setEsitoLoading] = useState(false);
  const [prioritaTarget, setPrioritaTarget] = useState<CandidaturaLike | null>(null);
  const [prioritaValue, setPrioritaValue] = useState<string>('');
  const [annullaTarget, setAnnullaTarget] = useState<CandidaturaLike | null>(null);
  const [rifiutaTarget, setRifiutaTarget] = useState<CandidaturaLike | null>(null);
  const [rifiutaNota, setRifiutaNota] = useState('');

  // Trasferisci
  const [transferTarget, setTransferTarget] = useState<CandidaturaLike | null>(null);
  const [transferCameraId, setTransferCameraId] = useState<string>('');
  const [transferData, setTransferData] = useState<string>(todayIso());
  const [transferFine, setTransferFine] = useState<string>('');

  // Concludi
  const [endTarget, setEndTarget] = useState<CandidaturaLike | null>(null);
  const [endData, setEndData] = useState<string>(todayIso());
  const [endNote, setEndNote] = useState('');
  const [endMotivo, setEndMotivo] = useState<string>('');

  // Assegna/rinnova/nuovo (unificato)
  const [assignMode, setAssignMode] = useState<{ kind: AssignMode; c: CandidaturaLike } | null>(null);
  const [asDataInizio, setAsDataInizio] = useState<string>('');
  const [asDataFine, setAsDataFine] = useState<string>('');
  const [asStrutturaId, setAsStrutturaId] = useState<string>('__all');
  const [asCameraId, setAsCameraId] = useState<string>('');
  const [asPosto, setAsPosto] = useState<number>(0);
  const [asNota, setAsNota] = useState<string>('');

  const closeAssign = () => {
    setAssignMode(null);
    setAsDataInizio(''); setAsDataFine(''); setAsStrutturaId('__all');
    setAsCameraId(''); setAsPosto(0); setAsNota('');
  };

  // Fetch candidatura di riferimento per default (periodo/struttura preferita)
  const assignCandDetails = useQuery({
    queryKey: ['assign-cand-details', assignMode?.c.id, assignMode?.kind],
    enabled: !!assignMode,
    queryFn: async () => {
      if (!assignMode) return null;
      const { data: cand } = await supabase.from('candidature')
        .select('id, periodo_inizio, periodo_fine, struttura_preferita_id, tipo_camera_preferito')
        .eq('id', assignMode.c.id).maybeSingle();
      // Per rinnova: default = giorno dopo data_fine_corrente
      if (assignMode.kind === 'rinnova' && assignMode.c.assegnazione_id) {
        const { data: att } = await supabase.from('assegnazioni')
          .select('data_fine, camera_id').eq('id', assignMode.c.assegnazione_id).maybeSingle();
        return { cand, rinnovoDa: att?.data_fine ?? null, cameraCorrente: att?.camera_id ?? null };
      }
      return { cand, rinnovoDa: null as string | null, cameraCorrente: null as string | null };
    },
  });

  // Inizializza i default quando arrivano i dettagli
  useEffect(() => {
    if (!assignMode || !assignCandDetails.data) return;
    const { cand, rinnovoDa, cameraCorrente } = assignCandDetails.data;
    if (asDataInizio === '' && asDataFine === '') {
      if (assignMode.kind === 'rinnova' && rinnovoDa) {
        const nextStart = addDaysIso(rinnovoDa, 1);
        setAsDataInizio(nextStart < todayIso() ? todayIso() : nextStart);
        // default fine: +12 mesi
        const d = new Date(nextStart + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + 1);
        setAsDataFine(d.toISOString().split('T')[0]);
      } else if (cand?.periodo_inizio && cand?.periodo_fine) {
        setAsDataInizio(cand.periodo_inizio);
        setAsDataFine(cand.periodo_fine);
      } else {
        setAsDataInizio(todayIso());
      }
      if (cand?.struttura_preferita_id) setAsStrutturaId(cand.struttura_preferita_id);
      if (cameraCorrente) setAsCameraId(cameraCorrente);
    }
  }, [assignMode, assignCandDetails.data, asDataInizio, asDataFine]);

  // Query camere disponibili nel periodo
  const asCamereQ = useQuery({
    queryKey: ['camere-disp', asDataInizio, asDataFine, asStrutturaId],
    enabled: !!assignMode && !!asDataInizio && !!asDataFine && asDataFine >= asDataInizio,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('camere_disponibilita', {
        p_dal: asDataInizio, p_al: asDataFine,
        p_struttura_id: asStrutturaId === '__all' ? null : asStrutturaId,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Lookup strutture
  const strutture = useQuery({
    queryKey: ['strutture-attive-hook'],
    enabled: !!assignMode,
    queryFn: async () => {
      const { data } = await supabase.from('strutture').select('id, nome').eq('attiva', true).order('nome');
      return data ?? [];
    },
  });

  // Camere di destinazione: caricate on-demand per il trasferimento.
  const { data: camereDest } = useQuery({
    queryKey: ['camere-transfer', transferData, transferFine],
    enabled: !!transferTarget && !!transferData && !!transferFine && transferFine >= transferData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('camere_disponibilita', {
        p_dal: transferData, p_al: transferFine, p_struttura_id: null,
      });
      if (error) throw error;
      const { data: strutt } = await supabase.from('strutture').select('id, nome');
      const byId = new Map((strutt ?? []).map((s: any) => [s.id, s.nome]));
      return (data ?? []).map((r: any) => ({ ...r, struttura_nome: byId.get(r.struttura_id) }));
    },
  });

  // ---- Handler -----------------------------------------------------------

  const runGenerateLink = useCallback(async (c: CandidaturaLike) => {
    setRegenConfirm(null); setLinkTarget(c); setLinkData(null);
    setLinkLoading(true); setLinkCopied(false);
    try {
      const { data, error } = await supabase.functions.invoke('generate-completion-link', {
        body: { candidatura_id: c.id, origin: window.location.origin },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const url = `${window.location.origin}/candidatura/completa/${(data as any).token}`;
      setLinkData({ url, scade_il: (data as any).scade_il });
      queryClient.invalidateQueries({ queryKey: ['candidature'] });
      for (const k of extraInvalidateKeys ?? []) {
        queryClient.invalidateQueries({ queryKey: k as unknown[] });
      }
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message ?? 'Impossibile generare il link', variant: 'destructive' });
      setLinkTarget(null);
    } finally { setLinkLoading(false); }
  }, [queryClient, toast, extraInvalidateKeys]);

  const requestStatoChange = useCallback((c: CandidaturaLike, nextStato: string) => {
    const rischioso = hasAssegnazioneAttiva(c) && nextStato === 'in_attesa_posto';
    if (rischioso) { setStatoConfirm({ c, nextStato }); return; }
    updateStato.mutate({ id: c.id, stato: nextStato });
  }, [hasAssegnazioneAttiva, updateStato]);

  const trigger = useCallback((id: CandidaturaActionId, c: CandidaturaLike) => {
    switch (id) {
      case 'invia_form_completo':
        if (c.token_scade_il && new Date(c.token_scade_il) > new Date()) setRegenConfirm(c);
        else runGenerateLink(c);
        return;
      case 'invia_esito':
        setEsitoNota(''); setEsitoTarget(c); return;
      case 'rifiuta':
        setRifiutaNota(''); setRifiutaTarget(c); return;
      case 'metti_in_attesa_posto':
        setPrioritaValue(''); setPrioritaTarget(c); return;
      case 'annulla_assegnazione':
        setAnnullaTarget(c); return;
      case 'trasferisci':
        setTransferCameraId('');
        setTransferData(todayIso());
        setTransferFine(c.data_fine_corrente ?? '');
        setTransferTarget(c);
        return;
      case 'concludi_soggiorno':
        setEndData(todayIso()); setEndNote(''); setEndMotivo(''); setEndTarget(c); return;
      case 'assegna_camera':
        setAssignMode({ kind: 'assegna', c }); return;
      case 'rinnova_soggiorno':
        setAssignMode({ kind: 'rinnova', c }); return;
      case 'nuovo_soggiorno':
        setAssignMode({ kind: 'nuovo', c }); return;
      case 'contatta':
        if (c.studenti?.email) {
          window.location.href = `mailto:${c.studenti.email}?subject=${encodeURIComponent('La tua candidatura - Studentato Europa')}`;
        }
        return;
      case 'elimina':
        setDeleteTarget(c); return;
    }
  }, [runGenerateLink]);

  const ctxValue = useMemo<Ctx>(
    () => ({ trigger, hasAssegnazioneAttiva, haAvutoAssegnazione }),
    [trigger, hasAssegnazioneAttiva, haAvutoAssegnazione],
  );

  const camereDisponibili = (camereDest ?? []).filter((c: any) => {
    if (transferTarget && c.camera_id === transferTarget.camera_id_corrente) return false;
    return (c.posti_liberi ?? 0) > 0;
  });

  // ---- Assign helpers ----------------------------------------------------

  // Prima riga libera per la camera selezionata
  const asCameraSelected = (asCamereQ.data ?? []).find((r: any) => r.camera_id === asCameraId);
  const asPostiLiberi: number[] = useMemo(() => {
    if (!asCameraSelected) return [];
    const occ: number[] = asCameraSelected.posti_occupati_numeri ?? [];
    const out: number[] = [];
    for (let p = 1; p <= asCameraSelected.posti; p++) if (!occ.includes(p)) out.push(p);
    return out;
  }, [asCameraSelected]);

  useEffect(() => {
    if (asPostiLiberi.length > 0 && !asPostiLiberi.includes(asPosto)) {
      setAsPosto(asPostiLiberi[0]);
    }
  }, [asPostiLiberi, asPosto]);

  // ---- Dialogs render ----------------------------------------------------

  const dialogs = (
    <>
      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la candidatura?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p><strong>{(deleteTarget as any)?.studenti?.nome} {(deleteTarget as any)?.studenti?.cognome}</strong></p>
                <p>L'operazione e' irreversibile e comprende:</p>
                <ul className="list-disc pl-5 text-[13px] space-y-1">
                  <li>eliminazione della candidatura</li>
                  <li>eliminazione di <strong>tutti i documenti caricati</strong> (documento d'identita', certificato iscrizione)</li>
                  <li>eliminazione dei log di cambio stato</li>
                  <li>eliminazione dello <strong>studente</strong> se non ha altre candidature o assegnazioni</li>
                </ul>
                <p className="text-[13px] text-muted-foreground">L'operazione fallisce se esiste anche solo un'assegnazione (storica) collegata: in quel caso usa "Segna come rinuncia".</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteCandidatura.mutate(deleteTarget)}
            >Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conferma cambio stato rischioso */}
      <AlertDialog open={!!statoConfirm} onOpenChange={open => { if (!open) setStatoConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confermare il cambio di stato?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-[13px]">
                <p>Esiste gia' un'<strong>assegnazione attiva</strong> per questa candidatura. Il cambio di stato non chiude l'assegnazione: lo studente resta residente. Per concludere il soggiorno vai in <strong>Residenti</strong>.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (statoConfirm) updateStato.mutate({ id: statoConfirm.c.id, stato: statoConfirm.nextStato });
              setStatoConfirm(null);
            }}>Procedi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Priorita' lista d'attesa */}
      <Dialog open={!!prioritaTarget} onOpenChange={open => { if (!open) setPrioritaTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Metti in lista d'attesa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              Le candidature in attesa sono ordinate per priorita' crescente (1 = prima). Lascia vuoto per ordinamento in fondo.
            </p>
            <div>
              <Label>Priorita'</Label>
              <Input type="number" min={1} value={prioritaValue}
                onChange={e => setPrioritaValue(e.target.value)} placeholder="es. 1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPrioritaTarget(null)}>Annulla</Button>
              <Button onClick={() => {
                if (!prioritaTarget) return;
                const p = prioritaValue.trim() === '' ? null : Math.max(1, parseInt(prioritaValue, 10) || 1);
                setPriorita.mutate({ id: prioritaTarget.id, priorita: p });
              }}>Conferma</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rifiuta con nota */}
      <Dialog open={!!rifiutaTarget} onOpenChange={open => { if (!open && !rifiutaMut.isPending) { setRifiutaTarget(null); setRifiutaNota(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Rifiuta candidatura</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              La candidatura verra' impostata su <strong>Rifiutata</strong> e verra' inviata subito l'email di esito a
              {' '}<strong>{(rifiutaTarget as any)?.studenti?.email}</strong>.
            </p>
            {rifiutaTarget && hasAssegnazioneAttiva(rifiutaTarget) && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-[13px] flex gap-2">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <span>Esiste un'assegnazione attiva collegata: il rifiuto <strong>non</strong> la chiude. Vai in Residenti per concludere il soggiorno.</span>
              </div>
            )}
            <div>
              <Label>Motivazione da includere in email (opzionale)</Label>
              <Textarea rows={4} maxLength={2000} value={rifiutaNota}
                onChange={e => setRifiutaNota(e.target.value.slice(0, 2000))}
                placeholder="Es. impossibilita' di collocazione nel periodo richiesto..." />
              <p className="text-[11px] text-muted-foreground mt-1">{rifiutaNota.length}/2000</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={rifiutaMut.isPending} onClick={() => { setRifiutaTarget(null); setRifiutaNota(''); }}>Annulla</Button>
            <Button variant="destructive" disabled={rifiutaMut.isPending}
              onClick={() => rifiutaTarget && rifiutaMut.mutate({ c: rifiutaTarget, nota: rifiutaNota.trim() })}>
              {rifiutaMut.isPending ? 'Invio...' : 'Rifiuta e invia email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Annulla assegnazione */}
      <AlertDialog open={!!annullaTarget} onOpenChange={open => { if (!open) setAnnullaTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annullare l'assegnazione?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-[13px]">
                <p>L'assegnazione verra' eliminata e la candidatura torna a <strong>Da decidere</strong>. Eventuale flag "esito comunicato" viene azzerato.</p>
                <p className="text-muted-foreground">Se il soggiorno e' gia' iniziato, dovrai invece <strong>concluderlo</strong> dalla pagina Residenti.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => annullaTarget && annullaAssegnazione.mutate(annullaTarget)}
            >Annulla assegnazione</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conferma rigenerazione link */}
      <AlertDialog open={!!regenConfirm} onOpenChange={open => { if (!open) setRegenConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rigenerare il link?</AlertDialogTitle>
            <AlertDialogDescription>
              Esiste gia' un link valido fino al{' '}
              <strong>{regenConfirm?.token_scade_il && new Date(regenConfirm.token_scade_il).toLocaleDateString('it-IT')}</strong>.
              Rigenerandolo, il <strong>vecchio link smettera' di funzionare</strong> e dovrai inviare il nuovo allo studente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => regenConfirm && runGenerateLink(regenConfirm)}>Rigenera link</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Completion link modal */}
      <Dialog open={!!linkTarget} onOpenChange={open => { if (!open) { setLinkTarget(null); setLinkData(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Invia form completo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {linkLoading && <p className="text-sm text-muted-foreground">Generazione link in corso...</p>}
            {linkData && linkTarget && (
              <>
                <p className="text-[13px] text-muted-foreground">
                  Copia il link e invialo via email a <strong>{(linkTarget as any).studenti?.email}</strong>. Scade il{' '}
                  {new Date(linkData.scade_il).toLocaleDateString('it-IT')}.
                </p>
                <div className="flex gap-2">
                  <Input readOnly value={linkData.url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                  <Button size="sm" onClick={async () => {
                    await navigator.clipboard.writeText(linkData.url);
                    setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000);
                  }}>{linkCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</Button>
                </div>
                {(linkTarget as any).studenti?.email && (
                  <Button asChild className="w-full" variant="outline">
                    <a href={`mailto:${(linkTarget as any).studenti.email}?subject=${encodeURIComponent('Completa la tua candidatura - Studentato Europa')}&body=${encodeURIComponent(
                      `Ciao ${(linkTarget as any).studenti?.nome ?? ''},\n\nla tua candidatura e' stata pre-approvata. Per completarla, compila il form al seguente link (valido fino al ${new Date(linkData.scade_il).toLocaleDateString('it-IT')}):\n\n${linkData.url}\n\nGrazie,\nStudentato Europa`
                    )}`}>
                      <Mail className="w-4 h-4 mr-2" /> Apri client email
                    </a>
                  </Button>
                )}
                <p className="text-[11px] text-muted-foreground">Per sicurezza il link viene mostrato solo una volta. Se lo perdi, puoi rigenerarlo.</p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Invio comunicazione esito */}
      <Dialog open={!!esitoTarget} onOpenChange={open => { if (!open && !esitoLoading) { setEsitoTarget(null); setEsitoNota(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {(esitoTarget as any)?.stato === 'accolta' ? 'Comunica esito: Accolta' : 'Comunica esito: Rifiutata'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Invieremo un'email a <strong>{(esitoTarget as any)?.studenti?.email}</strong> con l'esito della candidatura.
            </p>
            <div>
              <label className="text-[12px] font-medium">Nota per lo studente (opzionale)</label>
              <Textarea value={esitoNota} onChange={e => setEsitoNota(e.target.value.slice(0, 2000))}
                rows={5} placeholder="Aggiungi eventuali indicazioni personali..." className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">{esitoNota.length}/2000</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={esitoLoading} onClick={() => { setEsitoTarget(null); setEsitoNota(''); }}>Annulla</Button>
              <Button disabled={esitoLoading} onClick={() => {
                if (!esitoTarget) return;
                setEsitoLoading(true);
                sendEsito.mutate({ id: esitoTarget.id, nota: esitoNota.trim() });
              }}>
                <MailCheck className="w-4 h-4 mr-2" />
                {esitoLoading ? 'Invio in corso...' : 'Conferma e invia email'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trasferisci */}
      <Dialog open={!!transferTarget} onOpenChange={open => { if (!open) { setTransferTarget(null); setTransferCameraId(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Trasferisci residente</DialogTitle></DialogHeader>
          {transferTarget && (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{transferTarget.studenti?.cognome ?? ''} {transferTarget.studenti?.nome ?? ''}</strong>
                <br />
                <span className="text-muted-foreground">
                  Da camera {transferTarget.camera_numero_corrente ?? '-'} ({transferTarget.struttura_nome_corrente ?? ''})
                </span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Data inizio nuovo soggiorno *</Label>
                  <Input type="date" value={transferData} onChange={e => setTransferData(e.target.value)} />
                </div>
                <div>
                  <Label>Data fine nuovo soggiorno *</Label>
                  <Input type="date" value={transferFine} onChange={e => setTransferFine(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Nuova camera</Label>
                <Select value={transferCameraId} onValueChange={setTransferCameraId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona camera disponibile" /></SelectTrigger>
                  <SelectContent>
                    {camereDisponibili.map((c: any) => (
                      <SelectItem key={c.camera_id} value={c.camera_id}>
                        {c.struttura_nome} - Cam. {c.numero} ({c.posti - c.posti_liberi}/{c.posti})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[12px] text-muted-foreground">La vecchia assegnazione verra' chiusa il giorno precedente con motivo <strong>trasferimento</strong>.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferTarget(null)}>Annulla</Button>
            <Button
              disabled={!transferCameraId || !transferData || !transferFine || transferFine < transferData || trasferisci.isPending}
              onClick={() => transferTarget?.assegnazione_id && transferTarget.camera_id_corrente && trasferisci.mutate({
                assegnazione_id: transferTarget.assegnazione_id,
                vecchia_camera_id: transferTarget.camera_id_corrente,
                studente_id: transferTarget.studente_id ?? '',
                nuova_camera_id: transferCameraId,
                nuova_data_inizio: transferData,
                nuova_data_fine: transferFine,
              })}
            >Trasferisci</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Concludi soggiorno */}
      <AlertDialog open={!!endTarget} onOpenChange={open => { if (!open) setEndTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concludere il soggiorno?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-[13px]">
                <p><strong>{endTarget?.studenti?.cognome ?? ''} {endTarget?.studenti?.nome ?? ''}</strong> - Camera {endTarget?.camera_numero_corrente ?? '-'}.</p>
                <p>Lo studente uscira' dall'elenco Residenti; il posto si libera dal giorno successivo alla data di fine.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <div>
              <Label>Data fine *</Label>
              <Input type="date" value={endData} onChange={e => setEndData(e.target.value)} />
            </div>
            <div>
              <Label>Motivo chiusura *</Label>
              <Select value={endMotivo} onValueChange={setEndMotivo}>
                <SelectTrigger><SelectValue placeholder="Seleziona motivo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fine_naturale">Fine naturale</SelectItem>
                  <SelectItem value="partenza_anticipata">Partenza anticipata</SelectItem>
                  <SelectItem value="mai_arrivato">Mai arrivato</SelectItem>
                  <SelectItem value="allontanato">Allontanato</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nota (opzionale)</Label>
              <Textarea rows={2} value={endNote} onChange={e => setEndNote(e.target.value)} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={!endData || !endMotivo}
              onClick={() => endTarget?.assegnazione_id && concludi.mutate({
                assegnazione_id: endTarget.assegnazione_id, data: endData, note: endNote, motivo: endMotivo,
              })}
            >Conferma</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assegna / Rinnova / Nuovo soggiorno (unificato) */}
      <Dialog open={!!assignMode} onOpenChange={open => { if (!open && !assegnaSoggiorno.isPending) closeAssign(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {assignMode?.kind === 'assegna' && 'Assegna posto'}
              {assignMode?.kind === 'rinnova' && 'Rinnova soggiorno'}
              {assignMode?.kind === 'nuovo' && 'Nuovo soggiorno'}
            </DialogTitle>
          </DialogHeader>
          {assignMode && (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{assignMode.c.studenti?.cognome ?? ''} {assignMode.c.studenti?.nome ?? ''}</strong>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Data inizio *</Label>
                  <Input type="date" value={asDataInizio} onChange={e => setAsDataInizio(e.target.value)} />
                </div>
                <div>
                  <Label>Data fine *</Label>
                  <Input type="date" value={asDataFine} onChange={e => setAsDataFine(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Struttura</Label>
                <Select value={asStrutturaId} onValueChange={setAsStrutturaId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Tutte</SelectItem>
                    {(strutture.data ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assignCandDetails.data?.cand?.struttura_preferita_id && asStrutturaId !== assignCandDetails.data.cand.struttura_preferita_id && asStrutturaId !== '__all' && (
                  <p className="text-[11px] text-warning mt-1">Diversa dalla preferenza dello studente.</p>
                )}
              </div>
              <div>
                <Label>Camera</Label>
                {!asDataInizio || !asDataFine || asDataFine < asDataInizio ? (
                  <p className="text-[13px] text-muted-foreground py-2">Imposta prima le date.</p>
                ) : asCamereQ.isLoading ? (
                  <p className="text-[13px] text-muted-foreground py-2">Caricamento...</p>
                ) : (
                  <Select value={asCameraId} onValueChange={setAsCameraId}>
                    <SelectTrigger><SelectValue placeholder="Seleziona camera disponibile" /></SelectTrigger>
                    <SelectContent>
                      {(asCamereQ.data ?? [])
                        .filter((r: any) => (r.posti_liberi ?? 0) > 0 && r.stato === 'disponibile')
                        .map((r: any) => (
                          <SelectItem key={r.camera_id} value={r.camera_id}>
                            Cam. {r.numero} - {r.tipo} ({r.posti - r.posti_liberi}/{r.posti})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {asPostiLiberi.length > 1 && (
                <div>
                  <Label>Posto</Label>
                  <Select value={String(asPosto)} onValueChange={v => setAsPosto(parseInt(v, 10))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {asPostiLiberi.map(p => <SelectItem key={p} value={String(p)}>Posto {p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {assignMode.kind === 'assegna' && (
                <div>
                  <Label>Nota email di esito (opzionale)</Label>
                  <Textarea rows={3} maxLength={2000} value={asNota}
                    onChange={e => setAsNota(e.target.value.slice(0, 2000))}
                    placeholder="Aggiungi indicazioni personalizzate per l'accoglienza..." />
                </div>
              )}
              {assignMode.kind === 'assegna' && (
                <p className="text-[11px] text-muted-foreground">Alla conferma la candidatura passa in "Accolta" e viene inviata l'email di esito.</p>
              )}
              {assignMode.kind === 'rinnova' && (
                <p className="text-[11px] text-muted-foreground">Crea una nuova assegnazione contigua. Nessuna email.</p>
              )}
              {assignMode.kind === 'nuovo' && (
                <p className="text-[11px] text-muted-foreground">Crea una candidatura interna e una nuova assegnazione. Nessuna email.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={assegnaSoggiorno.isPending} onClick={closeAssign}>Annulla</Button>
            <Button
              disabled={!assignMode || !asCameraId || !asPosto || !asDataInizio || !asDataFine || asDataFine < asDataInizio || assegnaSoggiorno.isPending}
              onClick={() => assignMode && assegnaSoggiorno.mutate({
                mode: assignMode.kind, c: assignMode.c,
                camera_id: asCameraId, posto: asPosto,
                data_inizio: asDataInizio, data_fine: asDataFine,
                studente_id: assignMode.c.studente_id ?? '',
                nota_esito: asNota.trim(),
              })}
            >
              {assegnaSoggiorno.isPending ? 'Salvataggio...' : 'Conferma'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return { trigger, hasAssegnazioneAttiva, haAvutoAssegnazione, dialogs, ctxValue, Provider: CandidaturaActionsContext.Provider };
}

export { CandidaturaActionsContext };
