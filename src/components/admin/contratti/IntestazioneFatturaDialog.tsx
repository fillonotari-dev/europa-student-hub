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

  const anaCorrente = contratto?.anagrafiche_fatturazione ?? null;

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

  // Quanti altri contratti puntano alla stessa intestazione: la conseguenza si dice prima.
  useEffect(() => {
    if (!open || !anaCorrente?.id) { setAltriContratti(0); return; }
    let annullato = false;
    (async () => {
      const { count } = await supabase
        .from('contratti')
        .select('id', { count: 'exact', head: true })
        .eq('anagrafica_fatturazione_id', anaCorrente.id)
        .neq('id', contratto.id);
      if (!annullato) setAltriContratti(count ?? 0);
    })();
    return () => { annullato = true; };
  }, [open, anaCorrente?.id, contratto?.id]);

  const salva = async () => {
    const err = erroreAnagrafica(ana);
    if (err) { toast({ title: 'Dati incompleti', description: err, variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const studenteId: string = contratto.studente_id;
      const payload = payloadAnagrafica(ana, modalita, studenteId);
      const eraTerzo = anaCorrente ? !anaCorrente.studente_id : false;
      let anagraficaId: string | null = null;
      let eraCollegataFic = false;

      if (modalita === 'studente') {
        // L'indice unico parziale anagrafiche_fatt_studente_uniq garantisce una
        // sola anagrafica per studente: se esiste si aggiorna, altrimenti si crea.
        const { data: esistente } = await supabase
          .from('anagrafiche_fatturazione')
          .select('id, fic_entity_id')
          .eq('studente_id', studenteId)
          .maybeSingle();
        if (esistente) {
          const { error } = await supabase
            .from('anagrafiche_fatturazione').update(payload).eq('id', esistente.id);
          if (error) throw error;
          anagraficaId = esistente.id;
          eraCollegataFic = esistente.fic_entity_id != null;
        } else {
          const { data, error } = await supabase
            .from('anagrafiche_fatturazione').insert(payload).select('id').single();
          if (error) throw error;
          anagraficaId = data.id;
        }
      } else if (eraTerzo && anaCorrente) {
        const { error } = await supabase
          .from('anagrafiche_fatturazione').update(payload).eq('id', anaCorrente.id);
        if (error) throw error;
        anagraficaId = anaCorrente.id;
        eraCollegataFic = anaCorrente.fic_entity_id != null;
      } else {
        // Da "studente" a "altro soggetto": nuova riga. L'anagrafica dello
        // studente resta, appartiene alla persona e serve ai contratti successivi.
        const { data, error } = await supabase
          .from('anagrafiche_fatturazione').insert(payload).select('id').single();
        if (error) throw error;
        anagraficaId = data.id;
      }

      if (anagraficaId && anagraficaId !== anaCorrente?.id) {
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
            onModalitaChange={setModalita}
            ana={ana}
            onAnaChange={setAna}
            mostraNotaAnagraficaEsistente={modalita === 'studente'}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annulla</Button>
          <Button onClick={salva} disabled={saving}>{saving ? 'Salvataggio…' : 'Salva intestazione'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
