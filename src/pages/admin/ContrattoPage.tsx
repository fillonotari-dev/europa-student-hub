import { useMemo, useRef, useState } from 'react';
import { FicSyncAnagrafica } from '@/components/admin/contratti/FicSyncAnagrafica';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle, usePageBack } from '@/hooks/usePageTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContrattoDialog } from '@/components/admin/contratti/ContrattoDialog';
import { IntestazioneFatturaDialog } from '@/components/admin/contratti/IntestazioneFatturaDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { generaScadenzario, totaleRiga } from '@/lib/scadenzario';
import { imponibilePersonalizzato, partizionaMensilitaPerCambioCanone } from '@/lib/canoniRicalcolo';
import { eliminaContrattoBozza } from '@/lib/contrattoDelete';
import { fmtEuro, fmtIt, STATO_CONTRATTO_COLORS } from './Contratti';
import { cn } from '@/lib/utils';
import { AlertTriangle, Check, FileUp, FileText, Info, Pencil, Repeat, Trash2, Undo2, X } from 'lucide-react';

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const todayIso = () => new Date().toISOString().slice(0, 10);
const primoDelMeseDi = (iso: string) => (iso ? `${iso.slice(0, 7)}-01` : '');

export const MOTIVI_CHIUSURA_CONTRATTO: { value: string; label: string }[] = [
  { value: 'fine_naturale', label: 'Fine naturale (contratto giunto a scadenza)' },
  { value: 'partenza_anticipata', label: 'Partenza anticipata' },
  { value: 'risoluzione', label: 'Risoluzione' },
];

const Riga = ({ k, v }: { k: string; v: any }) =>
  v == null || v === '' ? null : (
    <div className="flex gap-2 text-sm"><span className="text-muted-foreground min-w-[170px]">{k}</span><span>{v}</span></div>
  );

export default function ContrattoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  usePageBack('/admin/contratti');

  const [confermaAttiva, setConfermaAttiva] = useState(false);
  const [editCanone, setEditCanone] = useState(false);
  const [nuovoCanone, setNuovoCanone] = useState('');
  const [confermaRicalcolo, setConfermaRicalcolo] = useState(false);
  const [confermaElimina, setConfermaElimina] = useState(false);
  const [editGiorno, setEditGiorno] = useState(false);
  const [nuovoGiorno, setNuovoGiorno] = useState('');
  const [rigaEdit, setRigaEdit] = useState<string | null>(null);
  const [bozzaRiga, setBozzaRiga] = useState<{ imponibile: string; scadenza: string; note: string }>({ imponibile: '', scadenza: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [chiudiOpen, setChiudiOpen] = useState(false);
  const [chiudiData, setChiudiData] = useState(todayIso());
  const [chiudiMotivo, setChiudiMotivo] = useState('');
  const [bozzaOpen, setBozzaOpen] = useState(false);
  const [sostituisciOpen, setSostituisciOpen] = useState(false);

  const { data: contratto, isLoading } = useQuery({
    queryKey: ['contratti', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratti')
        .select(`*, studenti(id, nome, cognome, email), strutture(nome), anagrafiche_fatturazione(*)`)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: canoni } = useQuery({
    queryKey: ['canoni', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('canoni').select('*').eq('contratto_id', id!).order('competenza');
      if (error) throw error;
      return data ?? [];
    },
  });

  usePageTitle(contratto ? `Contratto — ${contratto.studenti?.cognome ?? ''} ${contratto.studenti?.nome ?? ''}` : 'Contratto');

  const anteprima = useMemo(() => {
    if (!contratto) return [];
    return generaScadenzario({
      dataInizio: contratto.data_inizio,
      dataFine: contratto.data_fine,
      canoneMensile: Number(contratto.canone_mensile),
      aliquotaIva: Number(contratto.aliquota_iva),
      giornoScadenza: Number(contratto.giorno_scadenza),
    });
  }, [contratto]);

  // Il criterio vive in src/lib/canoniRicalcolo.ts e rispecchia la condizione
  // della funzione database aggiorna_canone_contratto: il conteggio mostrato
  // nel dialogo coincide con ciò che la RPC farà davvero.
  const partizione = useMemo(
    () => (contratto
      ? partizionaMensilitaPerCambioCanone(canoni ?? [], Number(contratto.canone_mensile), todayIso())
      : { aggiornate: [], protette: [], fuoriPerimetro: [] }),
    [canoni, contratto],
  );
  const daRicalcolare = partizione.aggiornate;
  const intoccabili = useMemo(
    () => (canoni ?? []).filter((c: any) => c.stato === 'fatturato' || c.stato === 'incassato'),
    [canoni],
  );

  const daAnnullare = useMemo(
    () => (canoni ?? []).filter((c: any) => c.stato === 'da_fatturare' && c.competenza > primoDelMeseDi(chiudiData)),
    [canoni, chiudiData],
  );

  const [intestazioneOpen, setIntestazioneOpen] = useState(false);
  // Comodità, non presidio: sparisce al ricaricamento della pagina. La garanzia
  // di allineamento arriva in D2, dove l'emissione risincronizza prima di creare
  // il documento (altrimenti la fattura uscirebbe con l'intestazione memorizzata
  // su Fatture in Cloud, correggibile solo con nota di credito).
  const [daRisincronizzare, setDaRisincronizzare] = useState(false);

  const depositoIncassato = !!contratto?.deposito_stato && contratto.deposito_stato !== 'atteso';
  const puoTornareInBozza = intoccabili.length === 0 && !depositoIncassato;

  const { data: successore } = useQuery({
    queryKey: ['contratti', 'successore', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from('contratti').select('id, data_inizio, data_fine, stato')
        .eq('contratto_precedente_id', id!).maybeSingle();
      return data;
    },
  });

  const { data: precedente } = useQuery({
    queryKey: ['contratti', 'precedente', contratto?.contratto_precedente_id],
    enabled: !!contratto?.contratto_precedente_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('contratti').select('id, data_inizio, data_fine, stato')
        .eq('id', contratto!.contratto_precedente_id!).maybeSingle();
      return data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['contratti'] });
    qc.invalidateQueries({ queryKey: ['canoni', id] });
  };

  const chiudi = async () => {
    if (!contratto) return;
    if (!chiudiMotivo) {
      toast({ title: 'Motivo mancante', description: 'Seleziona il motivo di chiusura.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('chiudi_contratto', {
        p_contratto_id: contratto.id,
        p_data_fine: chiudiData,
        p_motivo: chiudiMotivo,
      });
      if (error) throw error;
      toast({
        title: 'Contratto chiuso',
        description: (data ?? 0) > 0 ? `Annullate ${data} mensilità successive al mese di chiusura.` : undefined,
      });
      setChiudiOpen(false);
      refresh();
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message ?? 'Chiusura non riuscita', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const tornaInBozza = async () => {
    if (!contratto) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('riporta_contratto_in_bozza', { p_contratto_id: contratto.id });
      if (error) throw error;
      toast({ title: 'Contratto riportato in bozza', description: 'Le mensilità sono state cancellate.' });
      setBozzaOpen(false);
      refresh();
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message ?? 'Operazione non riuscita', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const attiva = async () => {
    if (!contratto) return;
    setBusy(true);
    try {
      const righe = anteprima.map(r => ({
        competenza: r.competenza,
        imponibile: r.imponibile,
        aliquota_iva: r.aliquota_iva,
        scadenza: r.scadenza,
      }));
      // Attivazione atomica: inserimento mensilità e cambio stato nella stessa transazione.
      const { data, error } = await supabase.rpc('attiva_contratto', {
        p_contratto_id: contratto.id,
        p_righe: righe as any,
      });
      if (error) throw error;
      toast({ title: 'Contratto attivo', description: `Generate ${data ?? righe.length} mensilità.` });
      setConfermaAttiva(false);
      refresh();
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message ?? 'Attivazione non riuscita', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const salvaCanone = async () => {
    if (!contratto) return;
    const val = Number(nuovoCanone);
    if (nuovoCanone.trim() === '' || !Number.isFinite(val) || val <= 0) {
      toast({ title: 'Importo non valido', description: 'Inserisci un canone numerico maggiore di zero.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      // Canone e mensilità future aggiornati nella stessa transazione.
      const { data, error } = await supabase.rpc('aggiorna_canone_contratto', {
        p_contratto_id: contratto.id,
        p_canone: val,
      });
      if (error) throw error;
      toast({
        title: 'Canone aggiornato',
        description: (data ?? 0) > 0 ? `Ricalcolate ${data} mensilità da fatturare.` : undefined,
      });
      setEditCanone(false); setConfermaRicalcolo(false);
      refresh();
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message ?? 'Aggiornamento non riuscito', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const salvaGiorno = async () => {
    if (!contratto) return;
    const g = Number(nuovoGiorno);
    if (nuovoGiorno.trim() === '' || !Number.isInteger(g) || g < 1 || g > 28) {
      toast({ title: 'Giorno non valido', description: 'Indica un numero intero da 1 a 28.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from('contratti').update({ giorno_scadenza: g }).eq('id', contratto.id);
      if (error) throw error;
      setEditGiorno(false);
      refresh();
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message ?? 'Modifica non riuscita', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const elimina = async () => {
    if (!contratto) return;
    setBusy(true);
    try {
      await eliminaContrattoBozza(contratto as any);
      toast({ title: 'Contratto eliminato' });
      setConfermaElimina(false);
      qc.invalidateQueries({ queryKey: ['contratti'] });
      navigate('/admin/contratti');
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message ?? 'Eliminazione non riuscita', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const salvaRiga = async (riga: any) => {
    const imp = Number(bozzaRiga.imponibile);
    if (bozzaRiga.imponibile.trim() === '' || !Number.isFinite(imp) || imp < 0) {
      toast({ title: 'Imponibile non valido', description: 'Inserisci un importo numerico maggiore o uguale a zero.', variant: 'destructive' });
      return;
    }
    if (!bozzaRiga.scadenza.trim() || Number.isNaN(new Date(`${bozzaRiga.scadenza}T00:00:00`).getTime())) {
      toast({ title: 'Scadenza non valida', description: 'Indica una data di scadenza valida.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from('canoni')
        .update({
          imponibile: imp,
          scadenza: bozzaRiga.scadenza,
          note: bozzaRiga.note.trim() === '' ? null : bozzaRiga.note.trim(),
        })
        .eq('id', riga.id);
      if (error) throw error;
      setRigaEdit(null);
      refresh();
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message ?? 'Modifica non riuscita', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const caricaPdf = async (file: File) => {
    if (!contratto) return;
    if (file.type !== 'application/pdf') {
      toast({ title: 'Formato non ammesso', description: 'Carica un file PDF.', variant: 'destructive' }); return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast({ title: 'File troppo grande', description: 'Il limite è 10 MB.', variant: 'destructive' }); return;
    }
    setBusy(true);
    try {
      const path = `${contratto.id}/${file.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error } = await supabase.storage.from('contratti').upload(path, file, { upsert: true, contentType: 'application/pdf' });
      if (error) throw error;
      const { error: e2 } = await supabase.from('contratti').update({ file_firmato_path: path }).eq('id', contratto.id);
      if (e2) throw e2;
      toast({ title: 'PDF caricato' });
      refresh();
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message ?? 'Caricamento non riuscito', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const apriPdf = async () => {
    if (!contratto?.file_firmato_path) return;
    const { data, error } = await supabase.storage.from('contratti').createSignedUrl(contratto.file_firmato_path, 60);
    if (error || !data?.signedUrl) {
      toast({ title: 'Errore', description: 'Impossibile aprire il documento', variant: 'destructive' }); return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) return <p className="text-muted-foreground">Caricamento…</p>;
  if (!contratto) {
    return (
      <div>
        <p className="text-muted-foreground">Contratto non trovato.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/admin/contratti')}>Torna ai contratti</Button>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap border-b border-border/60 pb-4">
        <div>
          <button className="text-lg font-semibold hover:underline"
            onClick={() => navigate(`/admin/studenti/${contratto.studente_id}`)}>
            {contratto.studenti?.cognome} {contratto.studenti?.nome}
          </button>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn('text-[11px] uppercase tracking-wider px-2 py-0.5 rounded',
              STATO_CONTRATTO_COLORS[contratto.stato] ?? 'bg-muted text-muted-foreground')}>{contratto.stato}</span>
            <span className="text-sm text-muted-foreground">
              {contratto.strutture?.nome} · {fmtIt(contratto.data_inizio)} → {fmtIt(contratto.data_fine)}
            </span>
            {contratto.motivo_chiusura && (
              <span className="text-sm text-muted-foreground">
                · chiuso per {String(contratto.motivo_chiusura).replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
        {contratto.stato === 'bozza' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setConfermaElimina(true)}>
              <Trash2 className="w-4 h-4 mr-2" />Elimina contratto
            </Button>
            <Button onClick={() => setConfermaAttiva(true)} disabled={busy}>Attiva contratto</Button>
          </div>
        )}
        {contratto.stato === 'attivo' && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {puoTornareInBozza && (
              <Button variant="outline" disabled={busy} onClick={() => setBozzaOpen(true)}>
                <Undo2 className="w-4 h-4 mr-2" />Riporta in bozza
              </Button>
            )}
            <Button variant="outline" disabled={busy} onClick={() => setSostituisciOpen(true)}>
              <Repeat className="w-4 h-4 mr-2" />Sostituisci contratto
            </Button>
            <Button disabled={busy}
              onClick={() => { setChiudiData(todayIso()); setChiudiMotivo(''); setChiudiOpen(true); }}>
              Chiudi contratto
            </Button>
          </div>
        )}
      </div>

      {contratto.stato === 'attivo' && !puoTornareInBozza && (
        <p className="text-xs text-muted-foreground -mt-3">
          Il contratto ha già prodotto documenti fiscali{depositoIncassato ? ' o movimenti sul deposito' : ''}:
          non può più essere riportato in bozza, può solo essere chiuso.
        </p>
      )}

      {(precedente || successore) && (
        <div className="flex flex-col gap-1 text-sm">
          {precedente && (
            <button className="text-primary hover:underline text-left w-fit"
              onClick={() => navigate(`/admin/contratti/${precedente.id}`)}>
              Sostituisce il contratto del {fmtIt(precedente.data_inizio)} → {fmtIt(precedente.data_fine)}
            </button>
          )}
          {successore && (
            <button className="text-primary hover:underline text-left w-fit"
              onClick={() => navigate(`/admin/contratti/${successore.id}`)}>
              Sostituito dal contratto del {fmtIt(successore.data_inizio)} → {fmtIt(successore.data_fine)}
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-card border border-border/50 rounded-lg p-5 space-y-2">
          <h2 className="text-sm font-semibold mb-2">Contratto</h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground min-w-[170px]">Canone mensile</span>
            {editCanone ? (
              <>
                <Input className="h-8 w-32" type="number" step="0.01" value={nuovoCanone} onChange={e => setNuovoCanone(e.target.value)} />
                <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy}
                  onClick={() => (contratto.stato === 'attivo' ? setConfermaRicalcolo(true) : salvaCanone())}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditCanone(false)}><X className="w-4 h-4" /></Button>
              </>
            ) : (
              <>
                <span>{fmtEuro(contratto.canone_mensile)}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => { setNuovoCanone(String(contratto.canone_mensile)); setEditCanone(true); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
          <Riga k="Aliquota IVA" v={`${contratto.aliquota_iva}%`} />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground min-w-[170px]">Giorno di scadenza</span>
            {contratto.stato === 'bozza' && editGiorno ? (
              <>
                <Input className="h-8 w-20" type="number" min={1} max={28} value={nuovoGiorno}
                  onChange={e => setNuovoGiorno(e.target.value)} />
                <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy} onClick={salvaGiorno}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditGiorno(false)}><X className="w-4 h-4" /></Button>
              </>
            ) : (
              <>
                <span>{contratto.giorno_scadenza}</span>
                {contratto.stato === 'bozza' && (
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => { setNuovoGiorno(String(contratto.giorno_scadenza)); setEditGiorno(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
          {contratto.stato !== 'bozza' && (
            <p className="text-xs text-muted-foreground">Il giorno di scadenza è modificabile solo finché il contratto è in bozza.</p>
          )}
          <Riga k="Nota sul canone" v={contratto.canone_note} />
          <Riga k="Note" v={contratto.note} />
        </section>

        <section className="bg-card border border-border/50 rounded-lg p-5 space-y-2">
          {(() => {
            const ana: any = contratto.anagrafiche_fatturazione;
            return (
              <>
                <div className="flex items-center justify-between mb-2 gap-3">
                  <h2 className="text-sm font-semibold">Intestazione fattura</h2>
                  <Button size="sm" variant="outline" onClick={() => setIntestazioneOpen(true)}>Modifica</Button>
                </div>
                <Riga k="Intestatario" v={ana?.tipo === 'soggetto_giuridico' ? ana?.denominazione : `${ana?.nome ?? ''} ${ana?.cognome ?? ''}`.trim()} />
                <Riga k="Codice fiscale" v={ana?.codice_fiscale} />
                <Riga k="Partita IVA" v={ana?.partita_iva} />
                <Riga k="Indirizzo" v={[ana?.indirizzo_via, ana?.indirizzo_civico, ana?.indirizzo_cap, ana?.indirizzo_comune, ana?.indirizzo_provincia, ana?.indirizzo_nazione].filter(Boolean).join(' ')} />
                <Riga k="Codice destinatario" v={ana?.codice_destinatario} />
                <Riga k="PEC" v={ana?.pec} />
                <Riga k="Email di recapito" v={ana?.email_recapito} />
                {daRisincronizzare && (
                  <div className="mt-4 flex gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Dati modificati dopo l'ultimo collegamento a Fatture in Cloud: risincronizza per allineare il cliente.
                    </p>
                  </div>
                )}
                <FicSyncAnagrafica
                  anagrafica={ana}
                  onSynced={() => {
                    setDaRisincronizzare(false);
                    qc.invalidateQueries({ queryKey: ['contratti', id] });
                  }}
                />
              </>
            );
          })()}
        </section>

        <section className="bg-card border border-border/50 rounded-lg p-5 space-y-2">
          <h2 className="text-sm font-semibold mb-2">Garante</h2>
          {contratto.garante_nome || contratto.garante_email ? (
            <>
              <Riga k="Nome" v={contratto.garante_nome} />
              <Riga k="Relazione" v={contratto.garante_relazione} />
              <Riga k="Telefono" v={contratto.garante_telefono} />
              <Riga k="Email" v={contratto.garante_email} />
            </>
          ) : <p className="text-sm text-muted-foreground">Nessun garante indicato.</p>}
        </section>

        <section className="bg-card border border-border/50 rounded-lg p-5 space-y-2">
          <h2 className="text-sm font-semibold mb-2">Deposito cauzionale</h2>
          {contratto.deposito_richiesto ? (
            <>
              <Riga k="Importo" v={fmtEuro(contratto.deposito_importo)} />
              <Riga k="Stato" v={contratto.deposito_stato} />
              <Riga k="Data incasso" v={fmtIt(contratto.deposito_data_incasso)} />
              <Riga k="Modalità" v={contratto.deposito_modalita} />
              <Riga k="Importo restituito" v={contratto.deposito_importo_restituito != null ? fmtEuro(contratto.deposito_importo_restituito) : null} />
              <Riga k="Motivo trattenuta" v={contratto.deposito_motivo_trattenuta} />
            </>
          ) : (
            <>
              <p className="text-sm">Non richiesto</p>
              <Riga k="Motivo" v={contratto.deposito_motivo_esenzione} />
            </>
          )}
          <p className="text-xs text-muted-foreground pt-2">La gestione del ciclo del deposito arriva in un intervento successivo.</p>
        </section>
      </div>

      <section className="bg-card border border-border/50 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Contratto firmato</h2>
          <div className="flex gap-2">
            {contratto.file_firmato_path && (
              <Button size="sm" variant="outline" onClick={apriPdf}><FileText className="w-4 h-4 mr-2" />Apri</Button>
            )}
            <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              <FileUp className="w-4 h-4 mr-2" />{contratto.file_firmato_path ? 'Sostituisci PDF' : 'Carica PDF'}
            </Button>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) caricaPdf(f); e.target.value = ''; }} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Solo PDF, massimo 10 MB.</p>
      </section>

      <section className="bg-card border border-border/50 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50">
          <h2 className="text-sm font-semibold">Scadenzario</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-3 font-semibold">Competenza</th>
              <th className="text-left px-4 py-3 font-semibold">Imponibile</th>
              <th className="text-left px-4 py-3 font-semibold">IVA</th>
              <th className="text-left px-4 py-3 font-semibold">Totale</th>
              <th className="text-left px-4 py-3 font-semibold">Scadenza</th>
              <th className="text-left px-4 py-3 font-semibold">Stato</th>
              <th className="text-left px-4 py-3 font-semibold">Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(canoni ?? []).length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                Nessuna mensilità: lo scadenzario viene generato all'attivazione del contratto.
              </td></tr>
            )}
            {(canoni ?? []).map((c: any) => {
              const inEdit = rigaEdit === c.id;
              const modificabile = c.stato === 'da_fatturare';
              return (
                <tr key={c.id} className="border-t border-border/50">
                  <td className="px-4 py-2">{new Date(c.competenza + 'T00:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</td>
                  <td className="px-4 py-2">
                    {inEdit ? <Input className="h-8 w-28" type="number" step="0.01" value={bozzaRiga.imponibile}
                      onChange={e => setBozzaRiga(b => ({ ...b, imponibile: e.target.value }))} /> : (
                      <span className="inline-flex items-center gap-1.5">
                        {fmtEuro(c.imponibile)}
                        {contratto && c.stato === 'da_fatturare' && imponibilePersonalizzato(c, Number(contratto.canone_mensile)) && (
                          <span className="cursor-help"
                            // Dichiara solo il fatto osservabile: nessuna promessa sui
                            // cambi di canone, che dipende anche da stato e competenza.
                            title="L'importo di questa riga è diverso dal canone del contratto.">
                            <Info className="w-3.5 h-3.5 text-muted-foreground" aria-label="Importo personalizzato" />
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{c.aliquota_iva}%</td>
                  <td className="px-4 py-2">{fmtEuro(c.totale)}</td>
                  <td className="px-4 py-2">
                    {inEdit ? <Input className="h-8 w-36" type="date" value={bozzaRiga.scadenza}
                      onChange={e => setBozzaRiga(b => ({ ...b, scadenza: e.target.value }))} /> : fmtIt(c.scadenza)}
                  </td>
                  <td className="px-4 py-2">{c.stato}</td>
                  <td className="px-4 py-2">
                    {inEdit ? <Input className="h-8" value={bozzaRiga.note}
                      onChange={e => setBozzaRiga(b => ({ ...b, note: e.target.value }))} /> : (c.note ?? '—')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {modificabile && (inEdit ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy} onClick={() => salvaRiga(c)}><Check className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRigaEdit(null)}><X className="w-4 h-4" /></Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-8 w-8"
                        onClick={() => { setRigaEdit(c.id); setBozzaRiga({ imponibile: String(c.imponibile), scadenza: c.scadenza, note: c.note ?? '' }); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Anteprima e conferma di attivazione */}
      <AlertDialog open={confermaAttiva} onOpenChange={setConfermaAttiva}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Attivare il contratto?</AlertDialogTitle>
            <AlertDialogDescription>
              Verranno create {anteprima.length} mensilità. Dopo l'attivazione il contratto non è più cancellabile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-y-auto border border-border/50 rounded-lg">
            <table className="w-full text-sm">
              <tbody>
                {anteprima.map(r => (
                  <tr key={r.competenza} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-1.5">{new Date(r.competenza + 'T00:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</td>
                    <td className="px-3 py-1.5">{fmtEuro(r.imponibile)}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">scad. {fmtIt(r.scadenza)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtEuro(totaleRiga(r))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm">Totale complessivo: <strong>{fmtEuro(anteprima.reduce((s, r) => s + totaleRiga(r), 0))}</strong></p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); attiva(); }} disabled={busy}>Attiva e genera</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conferma ricalcolo mensilità */}
      <AlertDialog open={confermaElimina} onOpenChange={setConfermaElimina}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la bozza di contratto?</AlertDialogTitle>
            <AlertDialogDescription>
              L'operazione non è reversibile. {contratto.file_firmato_path
                ? 'Verrà eliminato prima il PDF allegato e poi il contratto. '
                : ''}
              I dati di fatturazione dello studente restano disponibili per altri contratti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annulla</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); elimina(); }} disabled={busy}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confermaRicalcolo} onOpenChange={setConfermaRicalcolo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ricalcolare le mensilità?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Verranno portate a {fmtEuro(Number(nuovoCanone))} {daRicalcolare.length} mensilità da fatturare con competenza corrente o futura.</p>
                {personalizzate.length > 0 && (
                  <p className="text-muted-foreground">
                    {personalizzate.length} {personalizzate.length === 1 ? 'mensilità ha' : 'mensilità hanno'} un importo personalizzato e non
                    {personalizzate.length === 1 ? ' verrà toccata' : ' verranno toccate'}: se serve, correggile a mano dalla tabella dello scadenzario.
                  </p>
                )}
                {intoccabili.length > 0 && (
                  <p>Non verranno toccate {intoccabili.length} mensilità già fatturate o incassate: corrispondono a documenti fiscali emessi.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); salvaCanone(); }} disabled={busy}>Conferma</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={chiudiOpen} onOpenChange={(o) => { if (!o) setChiudiOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chiudere il contratto?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Data di fine effettiva</Label>
                  <Input type="date" className="mt-1.5" value={chiudiData} onChange={e => setChiudiData(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Motivo</Label>
                  <Select value={chiudiMotivo} onValueChange={setChiudiMotivo}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Seleziona…" /></SelectTrigger>
                    <SelectContent>
                      {MOTIVI_CHIUSURA_CONTRATTO.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p>La data di fine del contratto verrà riscritta con quella indicata.</p>
                <p>Verranno annullate {daAnnullare.length} mensilità da fatturare successive al mese di chiusura. Il mese di chiusura resta dovuto per intero.</p>
                {intoccabili.length > 0 && (
                  <p>Restano intoccate {intoccabili.length} mensilità già fatturate o incassate: corrispondono a documenti fiscali emessi.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); chiudi(); }} disabled={busy}>Chiudi contratto</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bozzaOpen} onOpenChange={(o) => { if (!o) setBozzaOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Riportare il contratto in bozza?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Il contratto torna in bozza e <strong>tutte le {(canoni ?? []).length} mensilità verranno cancellate</strong>.</p>
                <p>Serve al contratto attivato per errore, che non ha prodotto alcun fatto economico: non resterà traccia di un rapporto mai esistito.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annulla</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); tornaInBozza(); }} disabled={busy}>Riporta in bozza</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <IntestazioneFatturaDialog
        open={intestazioneOpen}
        onOpenChange={setIntestazioneOpen}
        contratto={contratto}
        haFattureEmesse={intoccabili.length > 0}
        onSaved={({ eraCollegataFic }) => {
          if (eraCollegataFic) setDaRisincronizzare(true);
          qc.invalidateQueries({ queryKey: ['contratti', id] });
        }}
      />

      <ContrattoDialog
        open={sostituisciOpen}
        onOpenChange={setSostituisciOpen}
        sostituisce={contratto}
        onCreated={(nuovoId) => navigate(`/admin/contratti/${nuovoId}`)}
      />
    </div>
  );
}
