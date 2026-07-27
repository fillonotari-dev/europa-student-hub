import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MailCheck, Copy, CheckCircle, Mail } from 'lucide-react';
import {
  type CandidaturaActionId, type CandidaturaLike, reopenStato,
} from '@/lib/candidaturaActions';
import { formatStato } from '@/lib/statoCandidatura';

type Ctx = {
  trigger: (id: CandidaturaActionId, c: CandidaturaLike) => void;
  hasAssegnazioneAttiva: (c: CandidaturaLike) => boolean;
};

const CandidaturaActionsContext = createContext<Ctx | null>(null);

export function useCandidaturaActionsCtx(): Ctx {
  const ctx = useContext(CandidaturaActionsContext);
  if (!ctx) throw new Error('CandidaturaActionsContext non montato: istanzia useCandidaturaActions() a livello di pagina.');
  return ctx;
}

interface Options {
  /** Set opzionale di candidature con assegnazione attiva (per warning cambio stato). */
  candidatureConAssegnazione?: Set<string> | null;
  /** Chiavi extra da invalidare (es. viste della scheda persona). */
  extraInvalidateKeys?: readonly (readonly unknown[])[];
  /** Chiamata dopo eliminazione, per pulire selezioni locali della pagina. */
  onDeleted?: (c: CandidaturaLike) => void;
}

export function useCandidaturaActions(options: Options = {}) {
  const { candidatureConAssegnazione, extraInvalidateKeys, onDeleted } = options;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const hasAssegnazioneAttiva = useCallback(
    (c: CandidaturaLike) => !!candidatureConAssegnazione?.has(c.id),
    [candidatureConAssegnazione],
  );

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['candidature'] });
    queryClient.invalidateQueries({ queryKey: ['studenti-approvati'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    for (const k of extraInvalidateKeys ?? []) {
      queryClient.invalidateQueries({ queryKey: k as unknown[] });
    }
  }, [queryClient, extraInvalidateKeys]);

  // ---- Mutazioni ---------------------------------------------------------

  const updateStato = useMutation({
    mutationFn: async ({ id, stato }: { id: string; stato: string }) => {
      const { data: old } = await supabase.from('candidature').select('stato').eq('id', id).single();
      await supabase.from('candidature').update({ stato }).eq('id', id);
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('log_stato_candidature').insert({
        candidatura_id: id,
        stato_precedente: old?.stato,
        stato_nuovo: stato,
        cambiato_da: user?.id,
      });
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Stato aggiornato' });
    },
    onError: (e: any) => toast({ title: 'Errore', description: e?.message ?? 'Aggiornamento fallito', variant: 'destructive' }),
  });

  const deleteCandidatura = useMutation({
    mutationFn: async (c: CandidaturaLike) => {
      const { count } = await supabase
        .from('assegnazioni')
        .select('id', { count: 'exact', head: true })
        .eq('candidatura_id', c.id);
      if ((count ?? 0) > 0) throw new Error("Esiste un'assegnazione collegata: impossibile eliminare.");
      const { error } = await supabase.from('candidature').delete().eq('id', c.id);
      if (error) throw error;
      return c;
    },
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ['candidature'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      for (const k of extraInvalidateKeys ?? []) {
        queryClient.invalidateQueries({ queryKey: k as unknown[] });
      }
      toast({ title: 'Candidatura eliminata' });
      setDeleteTarget(null);
      onDeleted?.(c);
    },
    onError: (e: any) => toast({ title: 'Errore', description: e?.message, variant: 'destructive' }),
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
      queryClient.invalidateQueries({ queryKey: ['candidature'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      for (const k of extraInvalidateKeys ?? []) {
        queryClient.invalidateQueries({ queryKey: k as unknown[] });
      }
      toast({ title: 'Comunicazione esito inviata' });
      setEsitoTarget(null);
      setEsitoNota('');
    },
    onError: (e: any) => toast({ title: 'Errore', description: e?.message ?? 'Invio fallito', variant: 'destructive' }),
    onSettled: () => setEsitoLoading(false),
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

  // ---- Handler -----------------------------------------------------------

  const runGenerateLink = useCallback(async (c: CandidaturaLike) => {
    setRegenConfirm(null);
    setLinkTarget(c);
    setLinkData(null);
    setLinkLoading(true);
    setLinkCopied(false);
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
    } finally {
      setLinkLoading(false);
    }
  }, [queryClient, toast, extraInvalidateKeys]);

  const requestStatoChange = useCallback((c: CandidaturaLike, nextStato: string) => {
    const rischioso = hasAssegnazioneAttiva(c) &&
      (nextStato === 'rifiutata' || nextStato === 'ritirata' ||
       nextStato === 'ricevuta' || nextStato === 'completata');
    const approvaIncompleta = nextStato === 'approvata' && c.versione_form !== 'completa';
    if (rischioso || approvaIncompleta) {
      setStatoConfirm({ c, nextStato });
      return;
    }
    updateStato.mutate({ id: c.id, stato: nextStato });
  }, [hasAssegnazioneAttiva, updateStato]);

  const trigger = useCallback((id: CandidaturaActionId, c: CandidaturaLike) => {
    switch (id) {
      case 'invia_form_completo':
        if (c.token_scade_il && new Date(c.token_scade_il) > new Date()) {
          setRegenConfirm(c);
        } else {
          runGenerateLink(c);
        }
        return;
      case 'invia_esito':
        setEsitoNota('');
        setEsitoTarget(c);
        return;
      case 'approva':
        requestStatoChange(c, 'approvata');
        return;
      case 'rifiuta':
        requestStatoChange(c, 'rifiutata');
        return;
      case 'riapri':
        requestStatoChange(c, reopenStato(c));
        return;
      case 'segna_rinuncia':
        requestStatoChange(c, 'ritirata');
        return;
      case 'assegna_camera':
        navigate(`/admin/camere?candidatura=${c.id}`);
        return;
      case 'contatta':
        if (c.studenti?.email) {
          window.location.href = `mailto:${c.studenti.email}?subject=${encodeURIComponent('La tua candidatura - Studentato Europa')}`;
        }
        return;
      case 'elimina':
        setDeleteTarget(c);
        return;
    }
  }, [navigate, runGenerateLink, requestStatoChange]);

  const ctxValue = useMemo<Ctx>(() => ({ trigger, hasAssegnazioneAttiva }), [trigger, hasAssegnazioneAttiva]);

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
                <p>L'operazione è irreversibile. Verrà eliminata la candidatura, ma:</p>
                <ul className="list-disc pl-5 text-[13px] space-y-1">
                  <li>i <strong>documenti caricati</strong> resteranno in archivio fino a pulizia manuale</li>
                  <li>lo <strong>storico cambi di stato</strong> resta nei log</li>
                  <li>l'eliminazione <strong>fallirà</strong> se esiste un'assegnazione collegata</li>
                </ul>
                <p className="text-[13px] text-muted-foreground">Per registrare una rinuncia senza perdere i dati, usa "Segna come rinuncia".</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteCandidatura.mutate(deleteTarget)}
            >
              Elimina
            </AlertDialogAction>
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
                {statoConfirm && hasAssegnazioneAttiva(statoConfirm.c) && (
                  <p>
                    Esiste già un'<strong>assegnazione attiva</strong> per questa candidatura.
                    Cambiare stato a "{formatStato(statoConfirm.nextStato)}" non chiude l'assegnazione:
                    lo studente resterà residente. Per concludere il soggiorno vai in <strong>Residenti</strong>.
                  </p>
                )}
                {statoConfirm && statoConfirm.nextStato === 'approvata' && statoConfirm.c.versione_form !== 'completa' && (
                  <p>
                    Lo studente <strong>non ha ancora compilato il form completo</strong> (stile di vita, garante,
                    documenti aggiuntivi). Confermi di volerlo approvare comunque?
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (statoConfirm) updateStato.mutate({ id: statoConfirm.c.id, stato: statoConfirm.nextStato });
                setStatoConfirm(null);
              }}
            >
              Procedi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conferma rigenerazione link */}
      <AlertDialog open={!!regenConfirm} onOpenChange={open => { if (!open) setRegenConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rigenerare il link?</AlertDialogTitle>
            <AlertDialogDescription>
              Esiste già un link valido fino al{' '}
              <strong>{regenConfirm?.token_scade_il && new Date(regenConfirm.token_scade_il).toLocaleDateString('it-IT')}</strong>.
              Rigenerandolo, il <strong>vecchio link smetterà di funzionare</strong> e dovrai inviare il nuovo allo studente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => regenConfirm && runGenerateLink(regenConfirm)}>
              Rigenera link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Completion link modal */}
      <Dialog open={!!linkTarget} onOpenChange={open => { if (!open) { setLinkTarget(null); setLinkData(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invia form completo</DialogTitle>
          </DialogHeader>
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
                  <Button
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(linkData.url);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    }}
                  >
                    {linkCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                {(linkTarget as any).studenti?.email && (
                  <Button asChild className="w-full" variant="outline">
                    <a
                      href={`mailto:${(linkTarget as any).studenti.email}?subject=${encodeURIComponent('Completa la tua candidatura - Studentato Europa')}&body=${encodeURIComponent(
                        `Ciao ${(linkTarget as any).studenti?.nome ?? ''},\n\nla tua candidatura è stata pre-approvata. Per completarla, compila il form al seguente link (valido fino al ${new Date(linkData.scade_il).toLocaleDateString('it-IT')}):\n\n${linkData.url}\n\nGrazie,\nStudentato Europa`
                      )}`}
                    >
                      <Mail className="w-4 h-4 mr-2" /> Apri client email
                    </a>
                  </Button>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Per sicurezza il link viene mostrato solo una volta. Se lo perdi, puoi rigenerarlo.
                </p>
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
              {(esitoTarget as any)?.stato === 'approvata' ? 'Comunica esito: Approvata' : 'Comunica esito: Rifiutata'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Invieremo un'email a <strong>{(esitoTarget as any)?.studenti?.email}</strong> con l'esito della candidatura.
              {(esitoTarget as any)?.stato === 'approvata'
                ? " Successivamente potrai assegnare lo studente a una camera."
                : " Puoi aggiungere una nota che verrà inclusa nell'email."}
            </p>
            <div>
              <label className="text-[12px] font-medium">Nota per lo studente (opzionale)</label>
              <Textarea
                value={esitoNota}
                onChange={e => setEsitoNota(e.target.value.slice(0, 2000))}
                rows={5}
                placeholder="Aggiungi eventuali indicazioni personali per lo studente..."
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">{esitoNota.length}/2000</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={esitoLoading} onClick={() => { setEsitoTarget(null); setEsitoNota(''); }}>
                Annulla
              </Button>
              <Button
                disabled={esitoLoading}
                onClick={() => {
                  if (!esitoTarget) return;
                  setEsitoLoading(true);
                  sendEsito.mutate({ id: esitoTarget.id, nota: esitoNota.trim() });
                }}
              >
                <MailCheck className="w-4 h-4 mr-2" />
                {esitoLoading ? 'Invio in corso...' : 'Conferma e invia email'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  return { trigger, hasAssegnazioneAttiva, dialogs, ctxValue, Provider: CandidaturaActionsContext.Provider };
}

export { CandidaturaActionsContext };