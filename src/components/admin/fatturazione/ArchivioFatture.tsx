import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fmtEuro, fmtIt } from '@/pages/admin/Contratti';
import { STATO_FATTURA } from '@/lib/statiFatturazione';
import { meseSuccessivo } from '@/lib/meseFatturazione';
import { StatoBadge } from './StatoBadge';

const PAGE_SIZE = 15;
const FK_CANONI = 'canoni!canoni_fattura_stesso_contratto_fkey';
/** Tutto tranne in_invio, che vive nel pannello «Da riconciliare». */
export const STATI_ARCHIVIO_ESCLUSI = '(in_invio)';

const etichettaMese = (m: string) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

/**
 * Archivio paginato lato server: .range() di 15 righe e count esatto, ordinato
 * per data di creazione decrescente. Senza filtro il join sui canoni è
 * sinistro (compaiono anche le fatture senza mensilità, cioè gli errori); col
 * filtro per mese il join è interno, quindi quelle righe non compaiono.
 */
export function ArchivioFatture({ mesi }: { mesi: string[] }) {
  const [pagina, setPagina] = useState(1);
  const [meseFiltro, setMeseFiltro] = useState<string>('tutti');

  useEffect(() => { setPagina(1); }, [meseFiltro]);

  const { data, isLoading } = useQuery({
    queryKey: ['fatturazione-archivio', pagina, meseFiltro],
    queryFn: async () => {
      const filtra = meseFiltro !== 'tutti';
      let q = supabase
        .from('fatture')
        .select(
          `id, numero, numerazione, data, totale, stato, ei_status, url_documento, messaggio_errore, created_at,
           contratti(studenti(nome, cognome)), ${FK_CANONI}${filtra ? '!inner' : ''}(competenza)`,
          { count: 'exact' },
        )
        .not('stato', 'in', STATI_ARCHIVIO_ESCLUSI)
        .order('created_at', { ascending: false })
        .range((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE - 1);
      if (filtra) {
        q = q.gte('canoni.competenza', `${meseFiltro}-01`).lt('canoni.competenza', `${meseSuccessivo(meseFiltro)}-01`);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { righe: (data ?? []) as any[], totale: count ?? 0 };
    },
  });

  const totale = data?.totale ?? 0;
  const pagine = Math.max(1, Math.ceil(totale / PAGE_SIZE));
  const inizio = (pagina - 1) * PAGE_SIZE;

  return (
    <section className="bg-card border border-border/50 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border/50">
        <Select value={meseFiltro} onValueChange={setMeseFiltro}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-[320px]">
            <SelectItem value="tutti">Tutti i mesi</SelectItem>
            {mesi.map(m => <SelectItem key={m} value={m}>{etichettaMese(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        {meseFiltro !== 'tutti' && (
          <span className="text-xs text-muted-foreground">
            Col filtro per mese non compaiono le fatture senza mensilità collegata (per esempio quelle in errore).
          </span>
        )}
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
            <th className="text-left px-4 py-3 font-semibold">Studente</th>
            <th className="text-left px-4 py-3 font-semibold">Competenza</th>
            <th className="text-left px-4 py-3 font-semibold">Numero</th>
            <th className="text-left px-4 py-3 font-semibold">Data</th>
            <th className="text-left px-4 py-3 font-semibold">Totale</th>
            <th className="text-left px-4 py-3 font-semibold">Stato</th>
            <th className="text-left px-4 py-3 font-semibold">Invio elettronico</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {isLoading && (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Caricamento…</td></tr>
          )}
          {!isLoading && totale === 0 && (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nessuna fattura creata.</td></tr>
          )}
          {(data?.righe ?? []).map((f) => {
            const s = f.contratti?.studenti;
            const competenza = f.canoni?.[0]?.competenza as string | undefined;
            const numero = f.numero != null ? `${f.numero}${f.numerazione ?? ''}` : '—';
            return (
              <tr key={f.id} className="border-t border-border/50 hover:bg-muted/50 align-top">
                <td className="px-4 py-3">{s ? `${s.cognome ?? ''} ${s.nome ?? ''}`.trim() : '—'}</td>
                <td className="px-4 py-3">{competenza ? etichettaMese(competenza.slice(0, 7)) : '—'}</td>
                <td className="px-4 py-3">
                  {f.url_documento && f.numero != null
                    ? <a href={f.url_documento} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">{numero}</a>
                    : numero}
                </td>
                <td className="px-4 py-3">{f.data ? fmtIt(f.data) : new Date(f.created_at).toLocaleDateString('it-IT')}</td>
                <td className="px-4 py-3">{fmtEuro(f.totale)}</td>
                <td className="px-4 py-3 max-w-[320px]">
                  <StatoBadge mappa={STATO_FATTURA} stato={f.stato} />
                  {f.stato === 'errore' && f.messaggio_errore && (
                    <p className="mt-1 text-xs text-muted-foreground">{f.messaggio_errore}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{f.ei_status ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {totale > 0 && (
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-border/50 text-sm text-muted-foreground">
          <span>{inizio + 1}–{Math.min(inizio + PAGE_SIZE, totale)} di {totale}</span>
          <Button size="icon" variant="ghost" className="h-8 w-8" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)} aria-label="Pagina precedente">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" disabled={pagina >= pagine} onClick={() => setPagina(p => p + 1)} aria-label="Pagina successiva">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </section>
  );
}
