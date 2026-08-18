import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studenteId?: string | null;
  onCreated?: (contrattoId: string) => void;
};

type Modalita = 'studente' | 'terzo';

const oggi = () => new Date().toISOString().slice(0, 10);

const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>
);

export function ContrattoDialog({ open, onOpenChange, studenteId: studenteFisso, onCreated }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [studenteId, setStudenteId] = useState<string>(studenteFisso ?? '');
  const [strutturaId, setStrutturaId] = useState('');
  const [assegnazioneId, setAssegnazioneId] = useState<string | null>(null);
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const [giornoScadenza, setGiornoScadenza] = useState('1');
  const [canone, setCanone] = useState('');
  const [canoneNote, setCanoneNote] = useState('');
  const [aliquota, setAliquota] = useState('10');
  const [listinoMancante, setListinoMancante] = useState(false);
  const [note, setNote] = useState('');

  const [garante, setGarante] = useState({ nome: '', relazione: '', telefono: '', email: '' });

  const [depositoRichiesto, setDepositoRichiesto] = useState(true);
  const [depositoImporto, setDepositoImporto] = useState('');
  const [depositoEsenzione, setDepositoEsenzione] = useState('');

  const [modalita, setModalita] = useState<Modalita>('studente');
  const [anagraficaEsistenteId, setAnagraficaEsistenteId] = useState<string | null>(null);
  const [ana, setAna] = useState({
    tipo: 'persona_fisica',
    denominazione: '',
    nome: '',
    cognome: '',
    codice_fiscale: '',
    partita_iva: '',
    indirizzo_via: '',
    indirizzo_civico: '',
    indirizzo_cap: '',
    indirizzo_comune: '',
    indirizzo_provincia: '',
    indirizzo_nazione: 'IT',
    codice_destinatario: '0000000',
    pec: '',
    email_recapito: '',
  });

  const { data: strutture } = useQuery({
    queryKey: ['strutture-tutte'],
    queryFn: async () => (await supabase.from('strutture').select('id, nome').order('nome')).data ?? [],
  });

  const { data: studenti } = useQuery({
    queryKey: ['studenti-elenco'],
    enabled: open && !studenteFisso,
    queryFn: async () =>
      (await supabase.from('studenti').select('id, nome, cognome, email').order('cognome')).data ?? [],
  });

  // Precompilazione a partire dallo studente scelto.
  useEffect(() => {
    if (!open || !studenteId) return;
    let annullato = false;

    (async () => {
      const [{ data: studente }, { data: assegnazioni }, { data: candidature }, { data: anagrafica }] =
        await Promise.all([
          supabase.from('studenti').select('*').eq('id', studenteId).maybeSingle(),
          supabase
            .from('assegnazioni')
            .select('id, data_inizio, data_fine, stato, camere(id, tipo, struttura_id)')
            .eq('studente_id', studenteId)
            .eq('stato', 'attiva')
            .order('data_inizio', { ascending: false }),
          supabase
            .from('candidature')
            .select('garante_nome, garante_relazione, garante_telefono, garante_email, created_at')
            .eq('studente_id', studenteId)
            .order('created_at', { ascending: false })
            .limit(1),
          supabase.from('anagrafiche_fatturazione').select('*').eq('studente_id', studenteId).maybeSingle(),
        ]);
      if (annullato) return;

      const ass = (assegnazioni ?? []).find(
        (a: any) => !a.data_fine || a.data_fine >= oggi(),
      ) ?? (assegnazioni ?? [])[0];

      if (ass) {
        setAssegnazioneId(ass.id);
        setDataInizio(ass.data_inizio ?? '');
        setDataFine(ass.data_fine ?? '');
        if ((ass as any).camere?.struttura_id) setStrutturaId((ass as any).camere.struttura_id);
      }

      const cand = (candidature ?? [])[0];
      if (cand) {
        setGarante({
          nome: cand.garante_nome ?? '',
          relazione: cand.garante_relazione ?? '',
          telefono: cand.garante_telefono ?? '',
          email: cand.garante_email ?? '',
        });
      }

      // Canone proposto dal listino valido oggi.
      const sid = (ass as any)?.camere?.struttura_id;
      const tipoCamera = (ass as any)?.camere?.tipo;
      if (sid && tipoCamera) {
        const { data: listino } = await supabase
          .from('listini')
          .select('importo_mensile')
          .eq('struttura_id', sid)
          .eq('tipo_camera', tipoCamera)
          .lte('valido_dal', oggi())
          .or(`valido_al.is.null,valido_al.gte.${oggi()}`)
          .maybeSingle();
        if (!annullato) {
          if (listino?.importo_mensile != null) {
            setCanone(String(listino.importo_mensile));
            setListinoMancante(false);
          } else {
            setListinoMancante(true);
          }
        }
      } else {
        setListinoMancante(true);
      }

      if (anagrafica) {
        setAnagraficaEsistenteId(anagrafica.id);
        setAna(prev => ({
          ...prev,
          tipo: anagrafica.tipo ?? 'persona_fisica',
          denominazione: anagrafica.denominazione ?? '',
          nome: anagrafica.nome ?? '',
          cognome: anagrafica.cognome ?? '',
          codice_fiscale: anagrafica.codice_fiscale ?? '',
          partita_iva: anagrafica.partita_iva ?? '',
          indirizzo_via: anagrafica.indirizzo_via ?? '',
          indirizzo_civico: anagrafica.indirizzo_civico ?? '',
          indirizzo_cap: anagrafica.indirizzo_cap ?? '',
          indirizzo_comune: anagrafica.indirizzo_comune ?? '',
          indirizzo_provincia: anagrafica.indirizzo_provincia ?? '',
          indirizzo_nazione: anagrafica.indirizzo_nazione ?? 'IT',
          codice_destinatario: anagrafica.codice_destinatario ?? '',
          pec: anagrafica.pec ?? '',
          email_recapito: anagrafica.email_recapito ?? '',
        }));
      } else if (studente) {
        setAnagraficaEsistenteId(null);
        setAna(prev => ({
          ...prev,
          tipo: 'persona_fisica',
          nome: studente.nome ?? '',
          cognome: studente.cognome ?? '',
          codice_fiscale: studente.codice_fiscale ?? '',
          indirizzo_via: studente.indirizzo_via ?? '',
          indirizzo_civico: studente.indirizzo_civico ?? '',
          indirizzo_cap: studente.indirizzo_cap ?? '',
          indirizzo_comune: studente.indirizzo_comune ?? '',
          indirizzo_provincia: studente.indirizzo_provincia ?? '',
          indirizzo_nazione: studente.indirizzo_nazione ?? 'IT',
          codice_destinatario: (studente.indirizzo_nazione ?? 'IT') === 'IT' ? '0000000' : 'XXXXXXX',
          email_recapito: studente.email ?? '',
        }));
      }
    })();

    return () => { annullato = true; };
  }, [open, studenteId]);

  // Proposta del codice destinatario al cambio nazione (solo se non compilato a mano).
  const proposto = ana.indirizzo_nazione === 'IT' ? '0000000' : 'XXXXXXX';
  useEffect(() => {
    setAna(prev =>
      prev.codice_destinatario === '' || prev.codice_destinatario === '0000000' || prev.codice_destinatario === 'XXXXXXX'
        ? { ...prev, codice_destinatario: proposto }
        : prev,
    );
  }, [proposto]);

  const datiFiscaliMancanti = useMemo(() => {
    const m: string[] = [];
    if (!ana.codice_fiscale && !ana.partita_iva) m.push('codice fiscale o partita IVA');
    if (!ana.codice_destinatario) m.push('codice destinatario');
    if (!ana.email_recapito && !ana.pec) m.push('email di recapito o PEC');
    return m;
  }, [ana]);

  const reset = () => {
    setStudenteId(studenteFisso ?? '');
    setStrutturaId(''); setAssegnazioneId(null);
    setDataInizio(''); setDataFine(''); setGiornoScadenza('1');
    setCanone(''); setCanoneNote(''); setAliquota('10'); setListinoMancante(false); setNote('');
    setGarante({ nome: '', relazione: '', telefono: '', email: '' });
    setDepositoRichiesto(true); setDepositoImporto(''); setDepositoEsenzione('');
    setModalita('studente'); setAnagraficaEsistenteId(null);
  };

  const errore = (): string | null => {
    if (!studenteId) return 'Seleziona lo studente.';
    if (!strutturaId) return 'Seleziona la struttura.';
    if (!dataInizio || !dataFine) return 'Indica le date di inizio e fine.';
    if (dataFine <= dataInizio) return 'La data di fine deve essere successiva a quella di inizio.';
    if (!canone || Number(canone) <= 0) return 'Indica un canone mensile maggiore di zero.';
    if (modalita === 'studente' && ana.tipo === 'persona_fisica' && (!ana.nome || !ana.cognome))
      return 'Nome e cognome sono obbligatori per una persona fisica.';
    if (modalita === 'terzo' && ana.tipo === 'soggetto_giuridico' && !ana.denominazione)
      return 'La denominazione è obbligatoria per un soggetto giuridico.';
    if (modalita === 'terzo' && ana.tipo === 'persona_fisica' && (!ana.nome || !ana.cognome))
      return 'Nome e cognome sono obbligatori per una persona fisica.';
    if (depositoRichiesto && (!depositoImporto || Number(depositoImporto) <= 0))
      return 'Indica l\'importo del deposito, oppure disattiva la richiesta di deposito.';
    if (!depositoRichiesto && !depositoEsenzione.trim())
      return 'Indica il motivo per cui il deposito non viene richiesto.';
    return null;
  };

  const nz = (v: string) => (v.trim() === '' ? null : v.trim());

  const handleSubmit = async () => {
    const err = errore();
    if (err) { toast({ title: 'Dati incompleti', description: err, variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payloadAna = {
        tipo: ana.tipo,
        denominazione: ana.tipo === 'soggetto_giuridico' ? nz(ana.denominazione) : null,
        nome: ana.tipo === 'persona_fisica' ? nz(ana.nome) : null,
        cognome: ana.tipo === 'persona_fisica' ? nz(ana.cognome) : null,
        codice_fiscale: nz(ana.codice_fiscale),
        partita_iva: nz(ana.partita_iva),
        indirizzo_via: nz(ana.indirizzo_via),
        indirizzo_civico: nz(ana.indirizzo_civico),
        indirizzo_cap: nz(ana.indirizzo_cap),
        indirizzo_comune: nz(ana.indirizzo_comune),
        indirizzo_provincia: nz(ana.indirizzo_provincia),
        indirizzo_nazione: ana.indirizzo_nazione || 'IT',
        codice_destinatario: nz(ana.codice_destinatario?.toUpperCase()),
        pec: nz(ana.pec),
        email_recapito: nz(ana.email_recapito),
        studente_id: modalita === 'studente' ? studenteId : null,
      };

      let anagraficaId: string;
      if (modalita === 'studente' && anagraficaEsistenteId) {
        const { error } = await supabase
          .from('anagrafiche_fatturazione')
          .update(payloadAna)
          .eq('id', anagraficaEsistenteId);
        if (error) throw error;
        anagraficaId = anagraficaEsistenteId;
      } else {
        const { data, error } = await supabase
          .from('anagrafiche_fatturazione')
          .insert(payloadAna)
          .select('id')
          .single();
        if (error) throw error;
        anagraficaId = data.id;
      }

      const { data: contratto, error: errC } = await supabase
        .from('contratti')
        .insert({
          studente_id: studenteId,
          struttura_id: strutturaId,
          assegnazione_id: assegnazioneId,
          anagrafica_fatturazione_id: anagraficaId,
          data_inizio: dataInizio,
          data_fine: dataFine,
          giorno_scadenza: Number(giornoScadenza) || 1,
          canone_mensile: Number(canone),
          canone_note: nz(canoneNote),
          aliquota_iva: Number(aliquota),
          garante_nome: nz(garante.nome),
          garante_relazione: nz(garante.relazione),
          garante_telefono: nz(garante.telefono),
          garante_email: nz(garante.email),
          deposito_richiesto: depositoRichiesto,
          deposito_importo: depositoRichiesto ? Number(depositoImporto) : null,
          deposito_stato: depositoRichiesto ? 'atteso' : null,
          deposito_motivo_esenzione: depositoRichiesto ? null : depositoEsenzione.trim(),
          note: nz(note),
          stato: 'bozza',
        })
        .select('id')
        .single();
      if (errC) throw errC;

      qc.invalidateQueries({ queryKey: ['contratti'] });
      toast({ title: 'Contratto creato', description: 'Il contratto è in bozza: verifica i dati e poi attivalo.' });
      onOpenChange(false);
      reset();
      onCreated?.(contratto.id);
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message ?? 'Impossibile creare il contratto', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo contratto</DialogTitle>
          <DialogDescription>
            I campi sono precompilati dove possibile. Il contratto nasce in bozza e resta modificabile
            finché non viene attivato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Contratto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!studenteFisso && (
                <F label="Studente *">
                  <Select value={studenteId} onValueChange={setStudenteId}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Seleziona…" /></SelectTrigger>
                    <SelectContent>
                      {(studenti ?? []).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.cognome} {s.nome} — {s.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </F>
              )}
              <F label="Struttura *">
                <Select value={strutturaId} onValueChange={setStrutturaId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Seleziona…" /></SelectTrigger>
                  <SelectContent>
                    {(strutture ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <F label="Data inizio *">
                <Input type="date" className="mt-1.5" value={dataInizio} onChange={e => setDataInizio(e.target.value)} />
              </F>
              <F label="Data fine *">
                <Input type="date" className="mt-1.5" value={dataFine} onChange={e => setDataFine(e.target.value)} />
              </F>
              <F label="Canone mensile (€) *">
                <Input type="number" min="0" step="0.01" className="mt-1.5" value={canone}
                  onChange={e => setCanone(e.target.value)} />
                {listinoMancante && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nessun listino valido oggi per questa sede e tipo camera: inserisci l'importo a mano.
                  </p>
                )}
              </F>
              <F label="Aliquota IVA (%)">
                <Input type="number" min="0" step="0.01" className="mt-1.5" value={aliquota}
                  onChange={e => setAliquota(e.target.value)} />
              </F>
              <F label="Giorno di scadenza delle mensilità (1-28)">
                <Input type="number" min="1" max="28" className="mt-1.5" value={giornoScadenza}
                  onChange={e => setGiornoScadenza(e.target.value)} />
              </F>
              <F label="Nota sul canone">
                <Input className="mt-1.5" value={canoneNote} onChange={e => setCanoneNote(e.target.value)}
                  placeholder="Es. scostamento dal listino" />
              </F>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Deposito cauzionale</h3>
            <div className="flex items-center gap-3">
              <Switch checked={depositoRichiesto} onCheckedChange={setDepositoRichiesto} id="dep" />
              <Label htmlFor="dep" className="text-sm">Deposito richiesto</Label>
            </div>
            {depositoRichiesto ? (
              <F label="Importo del deposito (€) *">
                <Input type="number" min="0" step="0.01" className="mt-1.5" value={depositoImporto}
                  onChange={e => setDepositoImporto(e.target.value)} />
              </F>
            ) : (
              <F label="Motivo dell'esenzione *">
                <Textarea className="mt-1.5" value={depositoEsenzione} onChange={e => setDepositoEsenzione(e.target.value)}
                  placeholder="Es. locazione garantita dalla società sportiva" />
              </F>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Garante <span className="font-normal text-muted-foreground">(facoltativo)</span></h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <F label="Nome"><Input className="mt-1.5" value={garante.nome} onChange={e => setGarante(g => ({ ...g, nome: e.target.value }))} /></F>
              <F label="Relazione"><Input className="mt-1.5" value={garante.relazione} onChange={e => setGarante(g => ({ ...g, relazione: e.target.value }))} /></F>
              <F label="Telefono"><Input className="mt-1.5" value={garante.telefono} onChange={e => setGarante(g => ({ ...g, telefono: e.target.value }))} /></F>
              <F label="Email"><Input className="mt-1.5" value={garante.email} onChange={e => setGarante(g => ({ ...g, email: e.target.value }))} /></F>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Intestazione della fattura</h3>
            <Select
              value={modalita}
              onValueChange={(v: Modalita) => {
                setModalita(v);
                if (v === 'terzo') setAna(prev => ({ ...prev, tipo: 'soggetto_giuridico' }));
                else setAna(prev => ({ ...prev, tipo: 'persona_fisica' }));
              }}
            >
              <SelectTrigger className="w-full sm:w-[320px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="studente">Intesta allo studente</SelectItem>
                <SelectItem value="terzo">Intesta a un altro soggetto</SelectItem>
              </SelectContent>
            </Select>
            {modalita === 'studente' && anagraficaEsistenteId && (
              <p className="text-xs text-muted-foreground">
                Esiste già un'anagrafica di fatturazione per questa persona: verrà aggiornata con i dati qui sotto.
              </p>
            )}

            {modalita === 'terzo' && (
              <F label="Tipo soggetto">
                <Select value={ana.tipo} onValueChange={v => setAna(a => ({ ...a, tipo: v }))}>
                  <SelectTrigger className="mt-1.5 w-full sm:w-[320px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soggetto_giuridico">Società o ente</SelectItem>
                    <SelectItem value="persona_fisica">Persona fisica</SelectItem>
                  </SelectContent>
                </Select>
              </F>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ana.tipo === 'soggetto_giuridico' ? (
                <F label="Denominazione *"><Input className="mt-1.5" value={ana.denominazione} onChange={e => setAna(a => ({ ...a, denominazione: e.target.value }))} /></F>
              ) : (
                <>
                  <F label="Nome *"><Input className="mt-1.5" value={ana.nome} onChange={e => setAna(a => ({ ...a, nome: e.target.value }))} /></F>
                  <F label="Cognome *"><Input className="mt-1.5" value={ana.cognome} onChange={e => setAna(a => ({ ...a, cognome: e.target.value }))} /></F>
                </>
              )}
              <F label="Codice fiscale"><Input className="mt-1.5" value={ana.codice_fiscale} onChange={e => setAna(a => ({ ...a, codice_fiscale: e.target.value.toUpperCase() }))} /></F>
              <F label="Partita IVA"><Input className="mt-1.5" value={ana.partita_iva} onChange={e => setAna(a => ({ ...a, partita_iva: e.target.value }))} /></F>
              <F label="Via"><Input className="mt-1.5" value={ana.indirizzo_via} onChange={e => setAna(a => ({ ...a, indirizzo_via: e.target.value }))} /></F>
              <F label="Civico"><Input className="mt-1.5" value={ana.indirizzo_civico} onChange={e => setAna(a => ({ ...a, indirizzo_civico: e.target.value }))} /></F>
              <F label="CAP"><Input className="mt-1.5" value={ana.indirizzo_cap} onChange={e => setAna(a => ({ ...a, indirizzo_cap: e.target.value }))} /></F>
              <F label="Comune"><Input className="mt-1.5" value={ana.indirizzo_comune} onChange={e => setAna(a => ({ ...a, indirizzo_comune: e.target.value }))} /></F>
              <F label="Provincia"><Input className="mt-1.5" maxLength={2} value={ana.indirizzo_provincia} onChange={e => setAna(a => ({ ...a, indirizzo_provincia: e.target.value.toUpperCase() }))} /></F>
              <F label="Nazione"><Input className="mt-1.5" maxLength={2} value={ana.indirizzo_nazione} onChange={e => setAna(a => ({ ...a, indirizzo_nazione: e.target.value.toUpperCase() }))} /></F>
              <F label="Codice destinatario"><Input className="mt-1.5" maxLength={7} value={ana.codice_destinatario} onChange={e => setAna(a => ({ ...a, codice_destinatario: e.target.value.toUpperCase() }))} /></F>
              <F label="PEC"><Input className="mt-1.5" value={ana.pec} onChange={e => setAna(a => ({ ...a, pec: e.target.value }))} /></F>
              <F label="Email di recapito"><Input className="mt-1.5" value={ana.email_recapito} onChange={e => setAna(a => ({ ...a, email_recapito: e.target.value }))} /></F>
            </div>

            {datiFiscaliMancanti.length > 0 && (
              <div className="flex gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Dati fiscali mancanti: {datiFiscaliMancanti.join(', ')}. Il contratto si può creare lo stesso,
                  ma serviranno al momento della fattura.
                </p>
              </div>
            )}
          </section>

          <F label="Note interne">
            <Textarea className="mt-1.5" value={note} onChange={e => setNote(e.target.value)} />
          </F>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Creazione…' : 'Crea contratto'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
