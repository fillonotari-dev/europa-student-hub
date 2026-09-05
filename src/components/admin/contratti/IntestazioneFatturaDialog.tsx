import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import {
  AnagraficaFatturazioneFields, anaDaRiga, anaTerzoVuota, anaVuota, erroreAnagrafica, payloadAnagrafica,
  type AnaState, type Modalita,
} from './AnagraficaFatturazioneFields';
import { caricaAnaStudente } from './anagraficaStudente';
import { rigaDestinazioneAnagrafica } from '@/lib/anagraficaFatturazione';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Contratto con anagrafiche_fatturazione già caricata dalla query della scheda. */
  contratto: any;
  /** Il contratto ha almeno una mensilità fatturata o incassata. */
  haFattureEmesse: boolean;
  /** eraCollegataFic: l'anagrafica modificata aveva un fic_entity_id. */
  onSaved?: (info: { eraCollegataFic: boolean }) => void;
};

/**
 * Modifica dell'intestazione di fatturazione di un contratto già creato.
 * Riusa gli stessi campi della creazione (AnagraficaFatturazioneFields).
 */
export function IntestazioneFatturaDialog({ open, onOpenChange, contratto, haFattureEmesse, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [modalita, setModalita] = useState<Modalita>('studente');
  const [ana, setAna] = useState<AnaState>(anaVuota());
  const [altriContratti, setAltriContratti] = useState<number>(0);
  const [anagraficaStudenteId, setAnagraficaStudenteId] = useState<string | null>(null);
  const [caricando, setCaricando] = useState(false);

  const anaCorrente = contratto?.anagrafiche_fatturazione ?? null;
  const studenteId: string | undefined = contratto?.studente_id;

  // Precompilazione una volta sola per apertura: un refetch della scheda non
  // deve sovrascrivere quello che l'operatore sta scrivendo.
  const prefilledPer = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { prefilledPer.current = null; return; }
    const chiave = anaCorrente?.id ?? contratto?.id ?? '';
    if (prefilledPer.current === chiave) return;
    prefilledPer.current = chiave;
    if (anaCorrente) {
      setAna(anaDaRiga(anaCorrente));
      setModalita(anaCorrente.studente_id ? 'studente' : 'terzo');
    } else {
      setAna(anaVuota());
      setModalita('studente');
    }
  }, [open, anaCorrente, contratto?.id]);

  // Id dell'anagrafica dello studente: serve sia all'avviso sia al salvataggio,
  // anche quando il contratto è oggi intestato a un altro soggetto.
  useEffect(() => {
    if (!open || !studenteId) { setAnagraficaStudenteId(null); return; }
    let annullato = false;
    (async () => {
      const { data } = await supabase
        .from('anagrafiche_fatturazione').select('id').eq('studente_id', studenteId).maybeSingle();
      if (!annullato) setAnagraficaStudenteId(data?.id ?? null);
    })();
    return () => { annullato = true; };
  }, [open, studenteId]);

  // La riga che il salvataggio toccherà davvero: alimenta avviso e scrittura.
  const destinazione = rigaDestinazioneAnagrafica({ modalita, anagraficaStudenteId, anaCorrente });

  // Quanti altri contratti puntano a quella riga: la conseguenza si dice prima.
  useEffect(() => {
    if (!open || destinazione.azione !== 'aggiorna') { setAltriContratti(0); return; }
    let annullato = false;
    (async () => {
      const { count } = await supabase
        .from('contratti')
        .select('id', { count: 'exact', head: true })
        .eq('anagrafica_fatturazione_id', destinazione.id)
        .neq('id', contratto.id);
      if (!annullato) setAltriContratti(count ?? 0);
    })();
    return () => { annullato = true; };
  }, [open, destinazione.azione, destinazione.id, contratto?.id]);

  /**
   * Il cambio di modalità ricarica i campi: lasciarli com'erano significherebbe
   * scrivere i dati della società sull'anagrafica dello studente (condivisa fra
   * i suoi contratti e spinta su Fatture in Cloud) e viceversa.
   */
  const cambiaModalita = async (nuova: Modalita) => {
    if (nuova === modalita) return;
    if (nuova === 'terzo') { setModalita('terzo'); setAna(anaTerzoVuota()); return; }
    if (!studenteId) { setModalita('studente'); setAna({ ...anaVuota(), tipo: 'persona_fisica' }); return; }
    setCaricando(true);
    try {
      const { id, ana: caricata } = await caricaAnaStudente(studenteId);
      setAnagraficaStudenteId(id);
      setAna(caricata);
      setModalita('studente');
    } catch (e: any) {
      // Mai restare su "studente" con i dati del terzo in pagina.
      toast({
        title: 'Errore',
        description: e?.message ?? 'Impossibile caricare i dati dello studente.',
        variant: 'destructive',
      });
    } finally {
      setCaricando(false);
    }
  };

  const salva = async () => {
    const err = erroreAnagrafica(ana);
    if (err) { toast({ title: 'Dati incompleti', description: err, variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = payloadAnagrafica(ana, modalita, studenteId ?? null);
      let anagraficaId: string;
      let eraCollegataFic = false;

      if (destinazione.azione === 'aggiorna') {
        const { data: riga } = await supabase
          .from('anagrafiche_fatturazione').select('fic_entity_id').eq('id', destinazione.id).maybeSingle();
        eraCollegataFic = riga?.fic_entity_id != null;
        const { error } = await supabase
          .from('anagrafiche_fatturazione').update(payload).eq('id', destinazione.id);
        if (error) throw error;
        anagraficaId = destinazione.id;
      } else {
        // Nuova riga: l'anagrafica precedente resta, appartiene alla persona
        // e serve ai contratti successivi.
        const { data, error } = await supabase
          .from('anagrafiche_fatturazione').insert(payload).select('id').single();
        if (error) throw error;
        anagraficaId = data.id;
      }

      if (anagraficaId !== anaCorrente?.id) {
        const { error } = await supabase
          .from('contratti')
          .update({ anagrafica_fatturazione_id: anagraficaId })
          .eq('id', contratto.id);
        if (error) throw error;
      }


      toast({ title: 'Intestazione aggiornata' });
      onOpenChange(false);
      onSaved?.({ eraCollegataFic });
    } catch (e: any) {
      toast({
        title: 'Errore',
        description: e?.message ?? "Impossibile aggiornare l'intestazione",
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica intestazione fattura</DialogTitle>
          <DialogDescription>
            Puoi intestare il contratto allo studente oppure a un altro soggetto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {haFattureEmesse && (
            <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
              <p>
                Questo contratto ha già mensilità fatturate o incassate. Cambiare l'intestatario ora
                <strong> non modifica le fatture già emesse</strong>, che restano intestate a chi erano.
              </p>
            </div>
          )}

          {altriContratti > 0 && (
            <div className="flex gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground">
                Questa intestazione è usata anche da {altriContratti} altr{altriContratti === 1 ? 'o contratto' : 'i contratti'}:
                la modifica vale per tutti.
              </p>
            </div>
          )}

          <AnagraficaFatturazioneFields
            modalita={modalita}
            onModalitaChange={cambiaModalita}
            ana={ana}
            onAnaChange={setAna}
            mostraNotaAnagraficaEsistente={modalita === 'studente' && !!anagraficaStudenteId}
            disabilitato={caricando}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annulla</Button>
          <Button onClick={salva} disabled={saving || caricando}>{saving ? 'Salvataggio…' : 'Salva intestazione'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
