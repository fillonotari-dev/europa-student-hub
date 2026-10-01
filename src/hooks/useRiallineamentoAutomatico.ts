import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_FATTURAZIONE } from '@/components/admin/fatturazione/ArchivioFatture';
import type { EsitoRiallineamento } from '@/components/admin/fatturazione/RiepilogoRiallineamento';

const ORE_SOGLIA = 6;

/**
 * All'apertura di Fatturazione: se l'ultimo giro concluso di riallineamento
 * manca o ha più di 6 ore, invoca fic-riallinea (origine 'apertura') in
 * background. Un solo tentativo per caricamento, nessun nuovo tentativo; gli
 * errori si ignorano (resta il pulsante dell'Archivio). Restituisce l'esito
 * solo se il giro ha annullato fatture o trovato anomalie.
 */
export function useRiallineamentoAutomatico() {
  const avviato = useRef(false);
  const qc = useQueryClient();
  const [esito, setEsito] = useState<EsitoRiallineamento | null>(null);

  useEffect(() => {
    if (avviato.current) return;
    avviato.current = true;
    (async () => {
      try {
        const { data: ultimo } = await supabase.from('fic_log')
          .select('created_at').eq('operazione', 'riallinea').eq('payload_ridotto->>giro_concluso', 'true')
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < ORE_SOGLIA * 3_600_000) return;
        const { data, error } = await supabase.functions.invoke('fic-riallinea', { body: { origine: 'apertura' } });
        if (error || !data?.ok) return;
        for (const k of QUERY_FATTURAZIONE) qc.invalidateQueries({ queryKey: [k] });
        const e = data as EsitoRiallineamento;
        if ((e.annullate?.length ?? 0) > 0 || (e.anomalie?.length ?? 0) > 0) setEsito(e);
      } catch {
        /* silenzioso: la pagina resta utilizzabile */
      }
    })();
  }, [qc]);

  return { esito, chiudi: () => setEsito(null) };
}
