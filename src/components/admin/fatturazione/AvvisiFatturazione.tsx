import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { aggiungiGiorni, oggiRoma } from '@shared/fic-fattura';
import { stessoImporto } from '@shared/fic-collega';
import { SPIEGAZIONE_ANOMALIA } from './RiepilogoRiallineamento';

const FK_CANONI = 'canoni!canoni_fattura_stesso_contratto_fkey';
/** Finestra delle fatture controllate per l'avviso (più ampia dei 90 giorni del riallineamento). */
const GIORNI_FINESTRA = 180;
const GIORNI_NON_EMESSA = 3;

type Voce = { id: string; testo: string };

const numeroDi = (f: any) => (f?.numero != null ? `${f.numero}${f.numerazione ?? ''}` : 'senza numero');
const studenteDi = (f: any) => {
  const s = f?.contratti?.studenti;
  return s ? `${s.cognome ?? ''} ${s.nome ?? ''}`.trim() : '';
};

/**
 * Avviso sopra l'elenco del mese: fatture scartate dallo SDI, create e non
 * emesse da più di 3 giorni, con importo diverso dalla mensilità, o in
 * anomalia nell'ultimo giro di riallineamento (fic_log, operazione 'riallinea').
 */
export function AvvisiFatturazione() {
  const { data: voci } = useQuery({
    queryKey: ['fatturazione-avvisi'],
    queryFn: async (): Promise<Voce[]> => {
      const oggi = oggiRoma();
      const { data: fatture, error } = await supabase.from('fatture')
        .select(`id, numero, numerazione, data, totale, ei_status, contratti(studenti(nome, cognome)), ${FK_CANONI}(totale)`)
        .eq('stato', 'emessa')
        .gte('data', aggiungiGiorni(oggi, -GIORNI_FINESTRA));
      if (error) throw error;

      const out: Voce[] = [];
      for (const f of (fatture ?? []) as any[]) {
        const chi = `${numeroDi(f)}${studenteDi(f) ? ` (${studenteDi(f)})` : ''}`;
        if (f.ei_status && SDI_DA_RIEMETTERE.has(f.ei_status)) {
          const rif = f.ei_status === 'rejected' || f.ei_status === 'manual_rejected';
          out.push({ id: `${f.id}-s`, testo: `${chi}: ${rif ? 'rifiutata dal destinatario' : 'scartata dallo SDI'}, va riemessa.` });
        }
        if ((f.ei_status == null || f.ei_status === 'not_sent') && f.data && f.data < aggiungiGiorni(oggi, -GIORNI_NON_EMESSA)) {
          out.push({ id: `${f.id}-n`, testo: `${chi}: creata il ${f.data.split('-').reverse().join('/')} e non ancora emessa.` });
        }
        const canoni = (f.canoni ?? []) as { totale: number }[];
        const somma = canoni.reduce((t, c) => t + Number(c.totale ?? 0), 0);
        if (canoni.length > 0 && !stessoImporto(somma, f.totale)) {
          out.push({ id: `${f.id}-i`, testo: `${chi}: importo diverso dalla mensilità collegata.` });
        }
      }

      // Anomalie dell'ultimo giro concluso
      const { data: giro } = await supabase.from('fic_log')
        .select('payload_ridotto').eq('operazione', 'riallinea').eq('payload_ridotto->>giro_concluso', 'true')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      const giroId = (giro?.payload_ridotto as any)?.giro_id as string | undefined;
      if (giroId) {
        const { data: anom } = await supabase.from('fic_log')
          .select('payload_ridotto').eq('operazione', 'riallinea').eq('esito', 'anomalia')
          .eq('payload_ridotto->>giro_id', giroId);
        const righe = (anom ?? []).map(a => a.payload_ridotto as any).filter(p => p?.fattura_id);
        if (righe.length) {
          const { data: ff } = await supabase.from('fatture')
            .select('id, numero, numerazione, contratti(studenti(nome, cognome))')
            .in('id', righe.map(p => p.fattura_id));
          const mappa = new Map((ff ?? []).map((f: any) => [f.id, f]));
          for (const p of righe) {
            const f = mappa.get(p.fattura_id);
            const chi = `${numeroDi(f)}${studenteDi(f) ? ` (${studenteDi(f)})` : ''}`;
            out.push({ id: `${p.fattura_id}-a`, testo: `${chi}: ${SPIEGAZIONE_ANOMALIA[p.codice] ?? p.codice}.` });
          }
        }
      }
      return out;
    },
  });

  if (!voci || voci.length === 0) return null;
  return (
    <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="font-medium text-foreground">Fatture da controllare su Fatture in Cloud</p>
        <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
          {voci.map(v => <li key={v.id}>{v.testo}</li>)}
        </ul>
      </div>
    </div>
  );
}
