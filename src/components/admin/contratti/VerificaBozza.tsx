import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { campiMancantiPerFattura } from '@shared/fic-anagrafica';
import { coperturaMese, etichettaCopertura } from '@/lib/coperturaMese';
import { totaleRiga, type RigaScadenzario } from '@/lib/scadenzario';
import { lordoDaImponibile } from '@/lib/iva';
import { DEPOSITO_DA_DEFINIRE } from '@/lib/precompilaContratto';
import { fmtEuro, fmtIt } from '@/pages/admin/Contratti';

type Props = {
  contratto: any;
  camera: { numero: string | null; tipo: string | null } | null;
  listinoLordo: number | null;
  bloccanti: string[];
  righe: RigaScadenzario[];
  importi: Record<string, string>;
  onImporto: (competenza: string, lordo: string) => void;
  onModificaIntestazione: () => void;
  onRefresh: () => void;
};

const Fatto = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="text-sm"><div className="text-xs text-muted-foreground">{k}</div><div className="mt-0.5">{v}</div></div>
);

/** Deposito modificabile in bozza: importo richiesto, oppure motivo di esenzione. */
function DepositoBozza({ contratto, onRefresh }: { contratto: any; onRefresh: () => void }) {
  const { toast } = useToast();
  const daDefinire = !contratto.deposito_richiesto && contratto.deposito_motivo_esenzione === DEPOSITO_DA_DEFINIRE;
  const [richiesto, setRichiesto] = useState<boolean>(!!contratto.deposito_richiesto);
  const [importo, setImporto] = useState(contratto.deposito_importo != null ? String(contratto.deposito_importo) : '');
  const [motivo, setMotivo] = useState(daDefinire ? '' : (contratto.deposito_motivo_esenzione ?? ''));
  const [busy, setBusy] = useState(false);

  const salva = async () => {
    if (richiesto && !(Number(importo) > 0)) { toast({ title: 'Indica un importo maggiore di zero.', variant: 'destructive' }); return; }
    if (!richiesto && (!motivo.trim() || motivo.trim() === DEPOSITO_DA_DEFINIRE)) { toast({ title: 'Indica il motivo dell\u2019esenzione.', variant: 'destructive' }); return; }
    setBusy(true);
    const { error } = await supabase.from('contratti').update(richiesto
      ? { deposito_richiesto: true, deposito_importo: Number(importo), deposito_stato: 'atteso', deposito_motivo_esenzione: null }
      : { deposito_richiesto: false, deposito_importo: null, deposito_stato: null, deposito_motivo_esenzione: motivo.trim() },
    ).eq('id', contratto.id);
    setBusy(false);
    if (error) { toast({ title: 'Errore', description: error.message, variant: 'destructive' }); return; }
    onRefresh();
  };

  return (
    <div className="flex items-end gap-3 flex-wrap">
      <label className="flex items-center gap-2 text-sm"><Switch checked={richiesto} onCheckedChange={setRichiesto} />Richiesto</label>
      {richiesto
        ? <Input className="h-8 w-32" type="number" step="0.01" placeholder="Importo" value={importo} onChange={e => setImporto(e.target.value)} />
        : <Input className="h-8 w-72" placeholder="Motivo dell'esenzione" value={motivo} onChange={e => setMotivo(e.target.value)} />}
      <Button size="sm" variant="outline" disabled={busy} onClick={salva}>Salva deposito</Button>
    </div>
  );
}

/** Schermata di verifica di un contratto in bozza, prima dell'attivazione. */
export function VerificaBozza({ contratto, camera, listinoLordo, bloccanti, righe, importi, onImporto, onModificaIntestazione, onRefresh }: Props) {
  const lordo = lordoDaImponibile(Number(contratto.canone_mensile), Number(contratto.aliquota_iva) || 0);
  const origineCanone = !(Number(contratto.canone_mensile) > 0)
    ? 'canone da inserire'
    : listinoLordo != null && Math.abs(listinoLordo - lordo) < 0.005 ? 'da listino' : 'personalizzato';
  const daDefinire = !contratto.deposito_richiesto && contratto.deposito_motivo_esenzione === DEPOSITO_DA_DEFINIRE;
  const ana = contratto.anagrafiche_fatturazione;
  const mancanti = ana ? campiMancantiPerFattura(ana) : ['intestazione'];
  const intestazione = ana ? (ana.denominazione || `${ana.nome ?? ''} ${ana.cognome ?? ''}`.trim()) : '—';

  return (
    <section className="bg-card border border-border/50 rounded-lg p-5 space-y-4">
      <h2 className="text-sm font-semibold">Verifica prima dell'attivazione</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Fatto k="Persona" v={`${contratto.studenti?.cognome ?? ''} ${contratto.studenti?.nome ?? ''}`} />
        <Fatto k="Periodo" v={`${fmtIt(contratto.data_inizio)} → ${fmtIt(contratto.data_fine)}`} />
        <Fatto k="Sede e camera" v={`${contratto.strutture?.nome ?? '—'}${camera?.numero ? ` · camera ${camera.numero}` : ''}${camera?.tipo ? ` (${camera.tipo})` : ''}`} />
        <Fatto k="Canone lordo" v={<>{fmtEuro(lordo)} <span className="text-xs text-muted-foreground">{origineCanone}</span></>} />
        <Fatto k="Giorno di scadenza" v={`${contratto.giorno_scadenza} del mese successivo`} />
        <Fatto k="Deposito" v={daDefinire ? 'Deposito da definire' : contratto.deposito_richiesto ? fmtEuro(contratto.deposito_importo) : `Non richiesto (${contratto.deposito_motivo_esenzione})`} />
        <Fatto k="Intestazione fattura" v={intestazione || '—'} />
      </div>

      <div>
        <div className="text-xs text-muted-foreground mb-1.5">Deposito</div>
        <DepositoBozza key={`${contratto.deposito_richiesto}-${contratto.deposito_motivo_esenzione}-${contratto.deposito_importo}`} contratto={contratto} onRefresh={onRefresh} />
      </div>

      {bloccanti.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
          <span>Prima di attivare: {bloccanti.join('; ')}.</span>
        </div>
      )}
      {mancanti.length > 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg border border-accent/50 bg-accent/10 px-4 py-3 text-sm">
          <span>La fattura verrà rifiutata finché: {mancanti.join(', ')}.</span>
          <Button size="sm" variant="outline" onClick={onModificaIntestazione}>Modifica intestazione</Button>
        </div>
      )}

      <div>
        <div className="text-xs text-muted-foreground mb-1.5">Scadenzario proposto (importi modificabili riga per riga)</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2 font-semibold">Competenza</th>
              <th className="text-left px-3 py-2 font-semibold">Importo (IVA incl.)</th>
              <th className="text-left px-3 py-2 font-semibold">Scadenza</th>
              <th className="text-left px-3 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r, i) => {
              const cop = coperturaMese(r.competenza, contratto.data_inizio, contratto.data_fine);
              const estremo = i === 0 || i === righe.length - 1;
              return (
                <tr key={r.competenza} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-1.5">{new Date(r.competenza + 'T00:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</td>
                  <td className="px-3 py-1.5">
                    <Input className="h-8 w-28" type="number" step="0.01"
                      value={importi[r.competenza] ?? String(totaleRiga(r))}
                      onChange={e => onImporto(r.competenza, e.target.value)} />
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{fmtIt(r.scadenza)}</td>
                  <td className="px-3 py-1.5 text-xs">
                    {estremo && cop.parziale && (
                      <span className="text-destructive">mese parziale ({etichettaCopertura(cop)}): correggi l'importo</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
