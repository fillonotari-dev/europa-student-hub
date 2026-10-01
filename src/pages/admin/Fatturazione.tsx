import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { RowActions } from '@/components/admin/RowActions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ArrowRight, CheckCircle2, Link2, Loader2, Receipt, X } from 'lucide-react';
import { fmtEuro, fmtIt } from '@/pages/admin/Contratti';
import { EmettiFatturaDialog, type Anteprima, type RigaDaEmettere } from '@/components/admin/contratti/EmettiFatturaDialog';
import { CollegaFatturaDialog, type RigaDaCollegare } from '@/components/admin/fatturazione/CollegaFatturaDialog';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import { coperturaMese, etichettaCopertura } from '@/lib/coperturaMese';
import { oggiRoma } from '@shared/fic-fattura';
import { mesePredefinito, meseSuccessivo } from '@/lib/meseFatturazione';
import { SPIEGAZIONE_RICONCILIAZIONE, STATO_CANONE, STATO_FATTURA } from '@/lib/statiFatturazione';
import { StatoBadge } from '@/components/admin/fatturazione/StatoBadge';
import { ArchivioFatture, STATI_ARCHIVIO_ESCLUSI } from '@/components/admin/fatturazione/ArchivioFatture';

/** L'anteprima non chiama Fatture in Cloud: può permettersi gruppi ampi. */
const GRUPPO_ANTEPRIMA = 50;
/**
 * L'emissione sì: ogni canone costa due chiamate esterne (risincronizzazione
 * dell'intestazione + creazione del documento). Dieci per volta, non cinquanta:
 * cento chiamate in sequenza in una sola richiesta rischiano il timeout con
 * metà dei documenti già creati.
 */
const GRUPPO_EMISSIONE = 10;

/**
 * Fatturazione posticipata: il mese proposto è il più vecchio fra il mese
 * precedente a oggi (fuso Europe/Rome) e il mese più vecchio con mensilità da
 * fatturare. Regola in src/lib/meseFatturazione.ts, con test.
 */
const primoDelMese = (m: string) => `${m}-01`;
const FK_CANONI = 'canoni!canoni_fattura_stesso_contratto_fkey';
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
  /** "17 giorni su 30" quando il mese non è interamente coperto dal contratto. */
  copertura: string | null;
};

type Esito = { canone_id: string; ok: boolean; message?: string; dati?: Anteprima };

type Riepilogo = {
  riuscite: number;
  fallite: { etichetta: string; motivo: string }[];
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [selezione, setSelezione] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [riepilogo, setRiepilogo] = useState<Riepilogo | null>(null);
  const [daCollegare, setDaCollegare] = useState<RigaDaCollegare | null>(null);

  const meseUrl = searchParams.get('mese');
  const vista = searchParams.get('vista') === 'archivio' ? 'archivio' : 'fatturazione';

  // --- Mensilità da fatturare più vecchia: indipendente dal mese scelto ---
  const { data: piuVecchia, isSuccess: piuVecchiaPronta } = useQuery({
    queryKey: ['fatturazione-piu-vecchia'],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('canoni')
        .select('competenza, contratti!inner(stato)')
        .eq('stato', 'da_fatturare')
        .eq('contratti.stato', 'attivo')
        .order('competenza')
        .limit(1);
      if (error) throw error;
      return data?.[0]?.competenza ?? null;
    },
  });
  // Finché la query non risponde, il mese non è deciso e la tabella non compare.
  const mese = meseUrl || (piuVecchiaPronta ? mesePredefinito(oggiRoma(), piuVecchia) : null) || '';
  const meseDeciso = !!meseUrl || piuVecchiaPronta;

  const patchParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k); else next.set(k, v);
    }
    setSearchParams(next, { replace: true });
  };

  // --- Mensilità del mese scelto ---
  const { data: righe, isLoading } = useQuery({
    queryKey: ['fatturazione-canoni', mese],
    enabled: meseDeciso,
    queryFn: async (): Promise<Riga[]> => {
      const { data, error } = await supabase
        .from('canoni')
        .select(`id, competenza, imponibile, totale, aliquota_iva, scadenza, contratto_id,
                 contratti!inner(stato, data_inizio, data_fine, studenti(nome, cognome), strutture(nome))`)
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
          copertura: etichettaCopertura(
            coperturaMese(c.competenza, c.contratti?.data_inizio, c.contratti?.data_fine),
          ),
        }))
        .sort((a, b) => a.studente.localeCompare(b.studente, 'it'));
    },
  });

  // --- Arretrati: mensilità da fatturare precedenti al mese scelto ---
  const { data: arretrati } = useQuery({
    queryKey: ['fatturazione-arretrati', mese],
    enabled: meseDeciso,
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

  const invalidaTutto = () => {
    for (const k of ['fatturazione-canoni', 'fatturazione-arretrati', 'fatturazione-piu-vecchia',
      'fatturazione-riconciliare', 'fatturazione-archivio', 'fatturazione-archivio-conteggio',
      'fatturazione-mese-fatturate', 'fatturazione-prossimo-lotto', 'fatturazione-canoni-collegati']) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };

  const emetti = async () => {
    setBusy(true);
    const etichette = new Map(righeDialogo.map(r => [r.canoneId, r.etichetta]));
    const acc: Riepilogo = { riuscite: 0, fallite: [], interrotto: false };
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
      invalidaTutto();
    }
  };

  // --- Da riconciliare: in_invio, più emessa senza alcuna mensilità collegata ---
  // Due query mirate, nessuna lettura di tutte le fatture. Le fatture in errore
  // NON sono qui: il documento sicuramente non esiste, stanno nell'Archivio.
  const { data: daRiconciliare } = useQuery({
    queryKey: ['fatturazione-riconciliare'],
    queryFn: async () => {
      const sel = 'id, totale, stato, messaggio_errore, data, created_at, contratti(studenti(nome, cognome))';
      const [inInvio, orfane] = await Promise.all([
        supabase.from('fatture').select(sel).eq('stato', 'in_invio').order('created_at', { ascending: false }),
        supabase.from('fatture').select(`${sel}, ${FK_CANONI}(id)`).eq('stato', 'emessa')
          .is('canoni', null).order('created_at', { ascending: false }),
      ]);
      if (inInvio.error) throw inInvio.error;
      if (orfane.error) throw orfane.error;
      return [...(inInvio.data ?? []), ...(orfane.data ?? [])] as any[];
    },
  });

  // --- Conteggio dell'Archivio: stesso criterio della lista ---
  const { data: totaleArchivio } = useQuery({
    queryKey: ['fatturazione-archivio-conteggio'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('fatture').select('id', { count: 'exact', head: true })
        .not('stato', 'in', STATI_ARCHIVIO_ESCLUSI);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // --- Stato vuoto: mensilità già fatturate del mese e prossimo lotto ---
  const meseVuoto = meseDeciso && !isLoading && (righe ?? []).length === 0;
  const { data: fatturateMese } = useQuery({
    queryKey: ['fatturazione-mese-fatturate', mese],
    enabled: meseVuoto,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('canoni')
        .select('id, competenza, totale, stato, contratti!inner(studenti(nome, cognome))')
        .in('stato', ['fatturato', 'incassato'])
        .gte('competenza', primoDelMese(mese))
        .lt('competenza', primoDelMese(meseSuccessivo(mese)));
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const { data: prossimoLotto } = useQuery({
    queryKey: ['fatturazione-prossimo-lotto', mese],
    enabled: meseVuoto,
    queryFn: async () => {
      const prossimo = meseSuccessivo(mese);
      const { count, error } = await supabase
        .from('canoni')
        .select('id, contratti!inner(stato)', { count: 'exact', head: true })
        .eq('stato', 'da_fatturare')
        .eq('contratti.stato', 'attivo')
        .gte('competenza', primoDelMese(prossimo))
        .lt('competenza', primoDelMese(meseSuccessivo(prossimo)));
      if (error) throw error;
      return { mese: prossimo, n: count ?? 0 };
    },
  });

  const nomeStudente = (f: any) => {
    const s = f.contratti?.studenti;
    return s ? `${s.cognome ?? ''} ${s.nome ?? ''}`.trim() : '—';
  };

  const opzioniMese = mesiSelezionabili([...(mese ? [mese] : []), ...(arretrati ?? []).map((a: any) => a.competenza.slice(0, 7))]);
  const meseArretratoPiuVecchio = (arretrati ?? [])[0]?.competenza?.slice(0, 7);

  const collegata = (msg: string) => {
    setDaCollegare(null);
    toast.success(msg);
    invalidaTutto();
  };

  return (
    <div className="space-y-6">
      <CollegaFatturaDialog riga={daCollegare} onClose={() => setDaCollegare(null)} onCollegata={collegata} />
      <Tabs value={vista} onValueChange={(v) => patchParams({ vista: v === 'archivio' ? 'archivio' : null })}>
        <TabsList>
          <TabsTrigger value="fatturazione">Fatturazione</TabsTrigger>
          <TabsTrigger value="archivio">Archivio ({totaleArchivio ?? '…'})</TabsTrigger>
        </TabsList>

        <TabsContent value="fatturazione" className="space-y-6 mt-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={mese || undefined} onValueChange={v => patchParams({ mese: v })}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-[320px]">
            {opzioniMese.map(m => (
              <SelectItem key={m} value={m}>{etichettaMese(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {emettibili.length > 0 && (
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span>
              {selezionate.length} {selezionate.length === 1 ? 'mensilità' : 'mensilità'} — totale{' '}
              <strong>{fmtEuro(totaleSelezione)}</strong>
            </span>
            <Button disabled={selezionate.length === 0} onClick={() => setDialogOpen(true)}>
              <Receipt className="w-4 h-4 mr-2" />
              Crea le fatture selezionate
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground space-y-1">
        <p>
          La fattura viene creata su Fatture in Cloud e resta modificabile lì finché non viene emessa,
          cioè trasmessa allo SDI: l'emissione si fa da Fatture in Cloud.
        </p>
        <p>
          Nel gestionale la mensilità passa subito a fatturato e non torna indietro: un documento
          sbagliato va corretto su Fatture in Cloud, non cancellato.
        </p>
      </div>

      {(arretrati ?? []).length > 0 && meseArretratoPiuVecchio && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span>
            Ci sono <strong>{arretrati!.length}</strong>{' '}
            {arretrati!.length === 1 ? 'mensilità arretrata' : 'mensilità arretrate'} da fatturare,
            la più vecchia di {etichettaMese(meseArretratoPiuVecchio)}.
          </span>
          <Button size="sm" variant="outline" onClick={() => patchParams({ mese: meseArretratoPiuVecchio })}>
            Vai a {etichettaMese(meseArretratoPiuVecchio)}
          </Button>
        </div>
      )}

      {riepilogo && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Esito della creazione: {riepilogo.riuscite} {riepilogo.riuscite === 1 ? 'riuscita' : 'riuscite'}
              {riepilogo.fallite.length > 0 && `, ${riepilogo.fallite.length} non riuscite`}
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRiepilogo(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          {riepilogo.interrotto && (
            <p className="text-destructive">
              Una chiamata non ha ricevuto risposta: alcuni documenti potrebbero essere stati creati comunque.
              Non ritentare: verifica prima il pannello «Da riconciliare» e Fatture in Cloud.
            </p>
          )}
          {riepilogo.fallite.length > 0 && (
            <ul className="list-disc pl-5 space-y-1">
              {riepilogo.fallite.map((f, i) => (
                <li key={i}><strong>{f.etichetta}</strong>: {f.motivo}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(daRiconciliare ?? []).length > 0 && (
        <section className="bg-card border border-destructive/40 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 space-y-1">
            <h2 className="text-sm font-semibold">Da riconciliare</h2>
            <p className="text-xs text-muted-foreground">{SPIEGAZIONE_RICONCILIAZIONE.in_invio}</p>
            <p className="text-xs text-muted-foreground">{SPIEGAZIONE_RICONCILIAZIONE.emessa}</p>
            <p className="text-xs text-muted-foreground">È l'unico punto in cui il gestionale e Fatture in Cloud possono divergere. Sola lettura.</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-semibold">Studente</th>
                <th className="text-left px-4 py-3 font-semibold">Totale</th>
                <th className="text-left px-4 py-3 font-semibold">Stato</th>
                <th className="text-left px-4 py-3 font-semibold">Messaggio</th>
                <th className="text-left px-4 py-3 font-semibold">Data</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {daRiconciliare!.map((f: any) => (
                <tr key={f.id} className="border-t border-border/50 hover:bg-muted/50">
                  <td className="px-4 py-3">{nomeStudente(f)}</td>
                  <td className="px-4 py-3">{fmtEuro(f.totale)}</td>
                  <td className="px-4 py-3"><StatoBadge mappa={STATO_FATTURA} stato={f.stato} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{f.messaggio_errore ?? '—'}</td>
                  <td className="px-4 py-3">{f.data ? fmtIt(f.data) : new Date(f.created_at).toLocaleDateString('it-IT')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {meseDeciso && !isLoading && (righe ?? []).length === 0 && fatturateMese && (
        <RiepilogoMese
          mese={mese}
          nFatturate={fatturateMese.length}
          prossimo={prossimoLotto}
          onVai={(m) => patchParams({ mese: m })}
        />
      )}

      {!(meseDeciso && !isLoading && (righe ?? []).length === 0 && fatturateMese && fatturateMese.length === 0) && (
      <section className="bg-card border border-border/50 rounded-lg overflow-hidden">
        {emettibili.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-border/50 bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={selezionate.length > 0 && selezionate.length === emettibili.length}
                onCheckedChange={(v) => setSelezione(v ? new Set(emettibili.map(r => r.id)) : new Set())}
                aria-label="Seleziona tutte le pronte"
              />
              <span>Seleziona tutte ({emettibili.length})</span>
            </div>
          </div>
        )}

        <table className="w-full">
          <thead>
            <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="w-10 px-4 py-3" />
              <th className="text-left px-4 py-3 font-semibold">Studente</th>
              <th className="text-left px-4 py-3 font-semibold">Struttura</th>
              <th className="text-left px-4 py-3 font-semibold">Imponibile</th>
              <th className="text-left px-4 py-3 font-semibold">IVA</th>
              <th className="text-left px-4 py-3 font-semibold">Totale</th>
              <th className="text-left px-4 py-3 font-semibold">Scadenza</th>
              <th className="text-left px-4 py-3 font-semibold">Stato</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="text-sm">
            {(!meseDeciso || isLoading) && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Caricamento…</td></tr>
            )}
            {(righe ?? []).map(r => {
              const esito = esiti?.[r.id];
              const emettibile = !!esito?.ok;
              return (
                <tr key={r.id} className="border-t border-border/50 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selezione.has(r.id)}
                      disabled={!emettibile}
                      onCheckedChange={() => toggle(r.id)}
                      aria-label={`Seleziona ${r.studente}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {r.studente}
                    {r.copertura && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        <AlertTriangle className="w-3 h-3" />
                        mese parziale: {r.copertura}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.struttura}</td>
                  <td className="px-4 py-3">{fmtEuro(r.imponibile)}</td>
                  <td className="px-4 py-3">{fmtEuro(Math.round((r.totale - r.imponibile) * 100) / 100)}</td>
                  <td className="px-4 py-3">{fmtEuro(r.totale)}</td>
                  <td className="px-4 py-3">{fmtIt(r.scadenza)}</td>
                  <td className="px-4 py-3">
                    {valutazione && !esito && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />Controllo…
                      </span>
                    )}
                    {esito && emettibile && (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">Pronta</span>
                    )}
                    {esito && !emettibile && (
                      <span className="inline-flex rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{esito.message}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActions>
                      <DropdownMenuItem
                        onClick={() => setDaCollegare({
                          canoneId: r.id,
                          etichetta: `${r.studente} — ${etichettaMese(r.competenza.slice(0, 7))}`,
                          totale: r.totale,
                        })}
                      >
                        <Link2 className="w-4 h-4 mr-2" />Collega fattura esistente
                      </DropdownMenuItem>
                    </RowActions>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

        </TabsContent>

        <TabsContent value="archivio" className="mt-6">
          <ArchivioFatture mesi={opzioniMese} />
        </TabsContent>
      </Tabs>

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

export interface RigaFatturataDati {
  id: string;
  studente: string;
  struttura: string;
  imponibile: number;
  totale: number;
  scadenza: string;
  stato: string;
  numero: string | null;
  url: string | null;
}

/** Mensilità già fatturata: stesse colonne, nessuna selezione, nessun menu. */
function RigaFatturata({ r }: { r: RigaFatturataDati }) {
  return (
    <tr className="border-t border-border/50 hover:bg-muted/50">
      <td className="px-4 py-3" />
      <td className="px-4 py-3">{r.studente}</td>
      <td className="px-4 py-3 text-muted-foreground">{r.struttura}</td>
      <td className="px-4 py-3">{fmtEuro(r.imponibile)}</td>
      <td className="px-4 py-3">{fmtEuro(Math.round((r.totale - r.imponibile) * 100) / 100)}</td>
      <td className="px-4 py-3">{fmtEuro(r.totale)}</td>
      <td className="px-4 py-3">{fmtIt(r.scadenza)}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2">
          <StatoBadge mappa={STATO_CANONE} stato={r.stato} />
          {r.numero && (r.url
            ? <a href={r.url} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">{r.numero}</a>
            : <span className="text-muted-foreground">{r.numero}</span>)}
        </span>
      </td>
      <td className="px-4 py-3" />
    </tr>
  );
}

/** Riga sopra la tabella: mese completato o vuoto, e prossimo lotto. */
function RiepilogoMese({ mese, nFatturate, prossimo, onVai }: {
  mese: string;
  nFatturate: number;
  prossimo: { mese: string; n: number } | null | undefined;
  onVai: (m: string) => void;
}) {
  const nome = etichettaMese(mese);
  const Nome = nome.charAt(0).toUpperCase() + nome.slice(1);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <p className="font-medium text-foreground">
        {nFatturate > 0
          ? `${Nome} completato: ${nFatturate} ${nFatturate === 1 ? 'mensilità fatturata' : 'mensilità fatturate'}.`
          : 'Nessuna mensilità in questo mese'}
      </p>
      {prossimo && prossimo.n > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
          <span>
            Prossimo lotto: {etichettaMese(prossimo.mese)}, {prossimo.n} mensilità,
            da fatturare dal 1° {etichettaMese(meseSuccessivo(prossimo.mese))}
          </span>
          <Button size="sm" variant="outline" onClick={() => onVai(prossimo.mese)}>
            Vai <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
