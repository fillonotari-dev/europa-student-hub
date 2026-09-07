import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, Loader2, Receipt, X } from 'lucide-react';
import { fmtEuro, fmtIt } from '@/pages/admin/Contratti';
import { EmettiFatturaDialog, type Anteprima, type RigaDaEmettere } from '@/components/admin/contratti/EmettiFatturaDialog';
import { usePageTitle } from '@/hooks/usePageTitle';

/** L'anteprima non chiama Fatture in Cloud: può permettersi gruppi ampi. */
const GRUPPO_ANTEPRIMA = 50;
/**
 * L'emissione sì: ogni canone costa due chiamate esterne (risincronizzazione
 * dell'intestazione + creazione del documento). Dieci per volta, non cinquanta:
 * cento chiamate in sequenza in una sola richiesta rischiano il timeout con
 * metà dei documenti già creati.
 */
const GRUPPO_EMISSIONE = 10;

const meseCorrente = () => new Date().toISOString().slice(0, 7);
const primoDelMese = (m: string) => `${m}-01`;
const meseSuccessivo = (m: string) => {
  const [a, mm] = m.split('-').map(Number);
  return mm === 12 ? `${a + 1}-01` : `${a}-${String(mm + 1).padStart(2, '0')}`;
};
const etichettaMese = (m: string) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

/** Dodici mesi indietro e dodici avanti rispetto a oggi: copre arretrati e futuri. */
function mesiSelezionabili(extra: string[]): string[] {
  const oggi = new Date();
  const set = new Set<string>(extra);
  for (let i = -12; i <= 12; i++) {
    const d = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() + i, 1));
    set.add(d.toISOString().slice(0, 7));
  }
  return [...set].sort();
}

type Riga = {
  id: string;
  competenza: string;
  imponibile: number;
  totale: number;
  aliquota_iva: number;
  scadenza: string;
  contratto_id: string;
  studente: string;
  struttura: string;
};

type Esito = { canone_id: string; ok: boolean; message?: string; dati?: Anteprima; passi_saltati?: string[] };

type Riepilogo = {
  riuscite: number;
  fallite: { etichetta: string; motivo: string }[];
  passiSaltati: string[];
  interrotto: boolean;
};

const chunk = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

export default function Fatturazione() {
  usePageTitle('Fatturazione');
  const qc = useQueryClient();
  const [mese, setMese] = useState<string>(meseCorrente());
  const [selezione, setSelezione] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [riepilogo, setRiepilogo] = useState<Riepilogo | null>(null);

  // --- Mensilità del mese scelto ---
  const { data: righe, isLoading } = useQuery({
    queryKey: ['fatturazione-canoni', mese],
    queryFn: async (): Promise<Riga[]> => {
      const { data, error } = await supabase
        .from('canoni')
        .select(`id, competenza, imponibile, totale, aliquota_iva, scadenza, contratto_id,
                 contratti!inner(stato, studenti(nome, cognome), strutture(nome))`)
        .eq('stato', 'da_fatturare')
        .eq('contratti.stato', 'attivo')
        .gte('competenza', primoDelMese(mese))
        .lt('competenza', primoDelMese(meseSuccessivo(mese)));
      if (error) throw error;
      return (data ?? [])
        .map((c: any) => ({
          id: c.id,
          competenza: c.competenza,
          imponibile: Number(c.imponibile),
          totale: Number(c.totale),
          aliquota_iva: Number(c.aliquota_iva),
          scadenza: c.scadenza,
          contratto_id: c.contratto_id,
          studente: `${c.contratti?.studenti?.cognome ?? ''} ${c.contratti?.studenti?.nome ?? ''}`.trim() || '—',
          struttura: c.contratti?.strutture?.nome ?? '—',
        }))
        .sort((a, b) => a.studente.localeCompare(b.studente, 'it'));
    },
  });

  // --- Arretrati: mensilità da fatturare precedenti al mese scelto ---
  const { data: arretrati } = useQuery({
    queryKey: ['fatturazione-arretrati', mese],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('canoni')
        .select('id, competenza, contratti!inner(stato)')
        .eq('stato', 'da_fatturare')
        .eq('contratti.stato', 'attivo')
        .lt('competenza', primoDelMese(mese))
        .order('competenza');
      if (error) throw error;
      return data ?? [];
    },
  });

  // --- Guardie: le decide la funzione, non questa pagina ---
  const ids = useMemo(() => (righe ?? []).map(r => r.id), [righe]);
  const { data: esiti, isFetching: valutazione } = useQuery({
    queryKey: ['fatturazione-anteprime', mese, ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, Esito>> => {
      const mappa: Record<string, Esito> = {};
      for (const gruppo of chunk(ids, GRUPPO_ANTEPRIMA)) {
        const { data, error } = await supabase.functions.invoke('fic-emetti-fattura', {
          body: { canone_ids: gruppo, conferma: false },
        });
        if (error) throw error;
        for (const e of (data?.esiti ?? []) as Esito[]) mappa[e.canone_id] = e;
      }
      return mappa;
    },
  });

  useEffect(() => { setSelezione(new Set()); }, [mese]);

  const emettibili = useMemo(
    () => (righe ?? []).filter(r => esiti?.[r.id]?.ok),
    [righe, esiti],
  );
  const selezionate = useMemo(
    () => emettibili.filter(r => selezione.has(r.id)),
    [emettibili, selezione],
  );
  const totaleSelezione = selezionate.reduce((s, r) => s + r.totale, 0);

  const righeDialogo: RigaDaEmettere[] = selezionate.map(r => ({
    canoneId: r.id,
    etichetta: `${r.studente} — ${etichettaMese(r.competenza.slice(0, 7))}`,
    dati: esiti![r.id].dati as Anteprima,
  }));

  const toggle = (id: string) =>
    setSelezione(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const emetti = async () => {
    setBusy(true);
    const etichette = new Map(righeDialogo.map(r => [r.canoneId, r.etichetta]));
    const acc: Riepilogo = { riuscite: 0, fallite: [], passiSaltati: [], interrotto: false };
    try {
      for (const gruppo of chunk(selezionate.map(r => r.id), GRUPPO_EMISSIONE)) {
        try {
          const { data, error } = await supabase.functions.invoke('fic-emetti-fattura', {
            body: { canone_ids: gruppo, conferma: true },
          });
          if (error) throw error;
          for (const e of (data?.esiti ?? []) as Esito[]) {
            if (e.ok) {
              acc.riuscite += 1;
              for (const p of e.passi_saltati ?? []) if (!acc.passiSaltati.includes(p)) acc.passiSaltati.push(p);
            } else {
              acc.fallite.push({ etichetta: etichette.get(e.canone_id) ?? e.canone_id, motivo: e.message ?? 'Motivo non dichiarato.' });
            }
          }
        } catch {
          acc.interrotto = true;
          break;
        }
      }
    } finally {
      setBusy(false);
      setDialogOpen(false);
      setSelezione(new Set());
      setRiepilogo(acc);
      qc.invalidateQueries({ queryKey: ['fatturazione-canoni'] });
      qc.invalidateQueries({ queryKey: ['fatturazione-arretrati'] });
      qc.invalidateQueries({ queryKey: ['fatturazione-fatture'] });
    }
  };

  // --- Fatture: archivio e riconciliazione ---
  const { data: fatture } = useQuery({
    queryKey: ['fatturazione-fatture'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fatture')
        .select('*, contratti(studenti(nome, cognome))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: canoniFatturati } = useQuery({
    queryKey: ['fatturazione-canoni-collegati'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('canoni')
        .select('fattura_id, competenza')
        .not('fattura_id', 'is', null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const competenzaPerFattura = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of canoniFatturati ?? []) if (c.fattura_id) m[c.fattura_id] = c.competenza;
    return m;
  }, [canoniFatturati]);

  const nomeStudente = (f: any) => {
    const s = f.contratti?.studenti;
    return s ? `${s.cognome ?? ''} ${s.nome ?? ''}`.trim() : '—';
  };

  const daRiconciliare = (fatture ?? []).filter(
    (f: any) => f.stato === 'in_invio' || (f.stato === 'emessa' && !competenzaPerFattura[f.id]),
  );
  const archivio = (fatture ?? []).filter((f: any) => f.stato === 'emessa');

  const opzioniMese = mesiSelezionabili([mese, ...(arretrati ?? []).map((a: any) => a.competenza.slice(0, 7))]);
  const meseArretratoPiuVecchio = (arretrati ?? [])[0]?.competenza?.slice(0, 7);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Select value={mese} onValueChange={setMese}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-[320px]">
            {opzioniMese.map(m => (
              <SelectItem key={m} value={m}>{etichettaMese(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(arretrati ?? []).length > 0 && meseArretratoPiuVecchio && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span>
            Ci sono <strong>{arretrati!.length}</strong>{' '}
            {arretrati!.length === 1 ? 'mensilità arretrata' : 'mensilità arretrate'} da fatturare,
            la più vecchia di {etichettaMese(meseArretratoPiuVecchio)}.
          </span>
          <Button size="sm" variant="outline" onClick={() => setMese(meseArretratoPiuVecchio)}>
            Vai a {etichettaMese(meseArretratoPiuVecchio)}
          </Button>
        </div>
      )}

      {riepilogo && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Esito dell'emissione: {riepilogo.riuscite} {riepilogo.riuscite === 1 ? 'riuscita' : 'riuscite'}
              {riepilogo.fallite.length > 0 && `, ${riepilogo.fallite.length} non riuscite`}
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRiepilogo(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          {riepilogo.interrotto && (
            <p className="text-destructive">
              Una chiamata non ha ricevuto risposta: alcuni documenti potrebbero essere stati creati comunque.
              Non ritentare: verifica prima il pannello di riconciliazione qui sotto e Fatture in Cloud.
            </p>
          )}
          {riepilogo.fallite.length > 0 && (
            <ul className="list-disc pl-5 space-y-1">
              {riepilogo.fallite.map((f, i) => (
                <li key={i}><strong>{f.etichetta}</strong>: {f.motivo}</li>
              ))}
            </ul>
          )}
          {riepilogo.passiSaltati.length > 0 && (
            <p className="text-muted-foreground">Passi saltati: {riepilogo.passiSaltati.join('; ')}.</p>
          )}
        </div>
      )}

      <section className="bg-card border border-border/50 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="w-10 px-4 py-3" />
              <th className="text-left px-4 py-3 font-semibold">Studente</th>
              <th className="text-left px-4 py-3 font-semibold">Struttura</th>
              <th className="text-right px-4 py-3 font-semibold">Imponibile</th>
              <th className="text-right px-4 py-3 font-semibold">IVA</th>
              <th className="text-right px-4 py-3 font-semibold">Totale</th>
              <th className="text-left px-4 py-3 font-semibold">Scadenza</th>
              <th className="text-left px-4 py-3 font-semibold">Stato</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Caricamento…</td></tr>
            )}
            {!isLoading && (righe ?? []).length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                Nessuna mensilità da fatturare in {etichettaMese(mese)}.
              </td></tr>
            )}
            {(righe ?? []).map(r => {
              const esito = esiti?.[r.id];
              const emettibile = !!esito?.ok;
              return (
                <tr key={r.id} className="border-t border-border/50">
                  <td className="px-4 py-2">
                    <Checkbox
                      checked={selezione.has(r.id)}
                      disabled={!emettibile}
                      onCheckedChange={() => toggle(r.id)}
                      aria-label={`Seleziona ${r.studente}`}
                    />
                  </td>
                  <td className="px-4 py-2">{r.studente}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.struttura}</td>
                  <td className="px-4 py-2 text-right">{fmtEuro(r.imponibile)}</td>
                  <td className="px-4 py-2 text-right">{fmtEuro(Math.round((r.totale - r.imponibile) * 100) / 100)}</td>
                  <td className="px-4 py-2 text-right">{fmtEuro(r.totale)}</td>
                  <td className="px-4 py-2">{fmtIt(r.scadenza)}</td>
                  <td className="px-4 py-2">
                    {valutazione && !esito && (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />Controllo…
                      </span>
                    )}
                    {esito && emettibile && <span className="text-primary">Emettibile</span>}
                    {esito && !emettibile && (
                      <span className="text-destructive">{esito.message}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {emettibili.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={selezionate.length > 0 && selezionate.length === emettibili.length}
                onCheckedChange={(v) => setSelezione(v ? new Set(emettibili.map(r => r.id)) : new Set())}
                aria-label="Seleziona tutte le emettibili"
              />
              <span>Seleziona tutte le emettibili ({emettibili.length})</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span>
                {selezionate.length} {selezionate.length === 1 ? 'mensilità' : 'mensilità'} — totale{' '}
                <strong>{fmtEuro(totaleSelezione)}</strong>
              </span>
              <Button disabled={selezionate.length === 0} onClick={() => setDialogOpen(true)}>
                <Receipt className="w-4 h-4 mr-2" />Emetti le fatture selezionate
              </Button>
            </div>
          </div>
        )}
      </section>

      {daRiconciliare.length > 0 && (
        <section className="bg-card border border-destructive/40 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50">
            <h2 className="text-sm font-semibold">Da riconciliare</h2>
            <p className="text-xs text-muted-foreground">
              Fatture in corso di invio o emesse senza una mensilità collegata: è l'unico punto in cui
              il gestionale e Fatture in Cloud possono divergere. Sola lettura.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Studente</th>
                <th className="text-right px-4 py-3 font-semibold">Totale</th>
                <th className="text-left px-4 py-3 font-semibold">Stato</th>
                <th className="text-left px-4 py-3 font-semibold">Messaggio</th>
                <th className="text-left px-4 py-3 font-semibold">Data</th>
              </tr>
            </thead>
            <tbody>
              {daRiconciliare.map((f: any) => (
                <tr key={f.id} className="border-t border-border/50">
                  <td className="px-4 py-2">{nomeStudente(f)}</td>
                  <td className="px-4 py-2 text-right">{fmtEuro(f.totale)}</td>
                  <td className="px-4 py-2">{f.stato}</td>
                  <td className="px-4 py-2 text-muted-foreground">{f.messaggio_errore ?? '—'}</td>
                  <td className="px-4 py-2">{fmtIt(f.data) !== '—' ? fmtIt(f.data) : new Date(f.created_at).toLocaleDateString('it-IT')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="bg-card border border-border/50 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50">
          <h2 className="text-sm font-semibold">Archivio delle fatture emesse</h2>
          <p className="text-xs text-muted-foreground">Sola lettura, dalla più recente.</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-3 font-semibold">Studente</th>
              <th className="text-left px-4 py-3 font-semibold">Competenza</th>
              <th className="text-left px-4 py-3 font-semibold">Numero</th>
              <th className="text-left px-4 py-3 font-semibold">Sezionale</th>
              <th className="text-left px-4 py-3 font-semibold">Data</th>
              <th className="text-right px-4 py-3 font-semibold">Totale</th>
              <th className="text-left px-4 py-3 font-semibold">Invio elettronico</th>
            </tr>
          </thead>
          <tbody>
            {archivio.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                Nessuna fattura emessa.
              </td></tr>
            )}
            {archivio.map((f: any) => (
              <tr key={f.id} className="border-t border-border/50">
                <td className="px-4 py-2">{nomeStudente(f)}</td>
                <td className="px-4 py-2">
                  {competenzaPerFattura[f.id] ? etichettaMese(competenzaPerFattura[f.id].slice(0, 7)) : '—'}
                </td>
                <td className="px-4 py-2">{f.numero ?? '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">{f.numerazione || '—'}</td>
                <td className="px-4 py-2">{fmtIt(f.data)}</td>
                <td className="px-4 py-2 text-right">{fmtEuro(f.totale)}</td>
                <td className="px-4 py-2 text-muted-foreground">{f.ei_status ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <EmettiFatturaDialog
        open={dialogOpen}
        righe={righeDialogo}
        busy={busy}
        onOpenChange={(o) => { if (!busy) setDialogOpen(o); }}
        onConferma={emetti}
      />
    </div>
  );
}
