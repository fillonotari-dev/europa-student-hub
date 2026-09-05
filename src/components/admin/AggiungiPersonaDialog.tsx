import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { validateCodiceFiscale } from '@shared/codice-fiscale';
import { NATIONALITIES } from '@/lib/nationalities';
import { PROVINCE } from '@shared/province';
import { COUNTRIES } from '@shared/countries';
import { AlertTriangle, BedDouble } from 'lucide-react';

/**
 * Dialogo "Aggiungi persona" (toolbar di /admin/residenti).
 * Chiama la RPC crea_persona_manuale: lo stato della candidatura lo decide
 * la funzione (accolta con assegnazione, in_attesa_posto senza) e gli errori
 * arrivano già in italiano — qui vengono mostrati testualmente.
 * Tutti i sotto-componenti sono a livello di modulo per non perdere il focus.
 */

type FormState = {
  nome: string; cognome: string; email: string; telefono: string;
  data_nascita: string; nazionalita: string;
  codice_fiscale: string; cf_non_disponibile: boolean;
  indirizzo_via: string; indirizzo_civico: string; indirizzo_cap: string;
  indirizzo_comune: string; indirizzo_provincia: string; indirizzo_nazione: string;
};

const EMPTY: FormState = {
  nome: '', cognome: '', email: '', telefono: '',
  data_nascita: '', nazionalita: '',
  codice_fiscale: '', cf_non_disponibile: false,
  indirizzo_via: '', indirizzo_civico: '', indirizzo_cap: '',
  indirizzo_comune: '', indirizzo_provincia: '', indirizzo_nazione: 'IT',
};

function Campo({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px]">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}

export function AggiungiPersonaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [emailEsistente, setEmailEsistente] = useState<{ id: string } | null>(null);
  const [cfError, setCfError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sezione posto letto
  const [conPosto, setConPosto] = useState(false);
  const [sedeId, setSedeId] = useState('');
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [posto, setPosto] = useState('');

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setEmailEsistente(null); setCfError(null); setSubmitError(null); setSaving(false);
      setConPosto(false); setSedeId(''); setDataInizio(''); setDataFine(''); setCameraId(''); setPosto('');
    }
  }, [open]);

  const { data: strutture } = useQuery({
    queryKey: ['strutture-attive'],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from('strutture').select('id, nome').eq('attiva', true).order('nome');
      return data ?? [];
    },
  });

  // Disponibilità SOLO da camere_disponibilita (regola 16 §12): nessun calcolo JS.
  // Data fine vuota → orizzonte esplicito di un anno dalla data inizio.
  const pAl = useMemo(() => {
    if (dataFine) return dataFine;
    if (!dataInizio) return null;
    const d = new Date(dataInizio);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  }, [dataInizio, dataFine]);

  const { data: camereLibere } = useQuery({
    queryKey: ['camere-disp-manuale', dataInizio, pAl, sedeId],
    enabled: conPosto && !!dataInizio && !!pAl && !!sedeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('camere_disponibilita', {
        p_dal: dataInizio, p_al: pAl, p_struttura_id: sedeId,
      });
      if (error) throw error;
      return (data ?? []).filter((c: any) => c.posti_liberi > 0 && c.stato === 'disponibile');
    },
  });

  const cameraScelta = useMemo(
    () => (camereLibere ?? []).find((c: any) => c.camera_id === cameraId) as any,
    [camereLibere, cameraId],
  );
  const postiLiberi = useMemo(() => {
    if (!cameraScelta) return [] as number[];
    const occupati = new Set<number>(cameraScelta.posti_occupati_numeri ?? []);
    return Array.from({ length: cameraScelta.posti }, (_, i) => i + 1).filter(n => !occupati.has(n));
  }, [cameraScelta]);

  const checkEmail = async () => {
    const email = form.email.trim().toLowerCase();
    if (!email) { setEmailEsistente(null); return; }
    const { data } = await supabase.from('studenti').select('id').ilike('email', email).limit(1);
    setEmailEsistente(data?.[0] ?? null);
  };

  const validaCF = () => {
    if (form.cf_non_disponibile || !form.codice_fiscale.trim()) { setCfError(null); return true; }
    const cf = validateCodiceFiscale(form.codice_fiscale);
    setCfError(cf.ok ? null : 'Il codice fiscale non è valido');
    return cf.ok;
  };

  const canSubmit =
    form.nome.trim() && form.cognome.trim() && form.email.trim() &&
    !emailEsistente && !cfError &&
    (!conPosto || (sedeId && dataInizio && cameraId && posto));

  const submit = async () => {
    if (!validaCF()) return;
    setSaving(true); setSubmitError(null);
    const cf = form.cf_non_disponibile ? null : (validateCodiceFiscale(form.codice_fiscale).normalized || null);
    const p_studente = {
      nome: form.nome, cognome: form.cognome, email: form.email,
      telefono: form.telefono || null,
      data_nascita: form.data_nascita || null,
      nazionalita: form.nazionalita || null,
      codice_fiscale: cf,
      cf_non_disponibile: form.cf_non_disponibile,
      indirizzo_via: form.indirizzo_via || null,
      indirizzo_civico: form.indirizzo_civico || null,
      indirizzo_cap: form.indirizzo_cap || null,
      indirizzo_comune: form.indirizzo_comune || null,
      indirizzo_provincia: form.indirizzo_nazione === 'IT' ? (form.indirizzo_provincia || null) : null,
      indirizzo_nazione: form.indirizzo_nazione || null,
    };
    const p_assegnazione = conPosto
      ? { camera_id: cameraId, posto: parseInt(posto, 10), data_inizio: dataInizio, data_fine: dataFine || null }
      : null;
    const { data, error } = await supabase.rpc('crea_persona_manuale', {
      p_studente, p_candidatura: {}, p_assegnazione,
    } as any);
    setSaving(false);
    if (error) {
      // Gli errori della funzione sono già in italiano e specifici: mostrati testualmente.
      setSubmitError(error.message);
      return;
    }
    toast({ title: conPosto ? 'Persona aggiunta e assegnata al posto letto' : 'Persona aggiunta in lista d\u2019attesa' });
    onOpenChange(false);
    navigate(`/admin/studenti/${(data as any).studente_id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aggiungi persona</DialogTitle>
        </DialogHeader>

        {/* Anagrafica */}
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Nome" required><Input value={form.nome} onChange={set('nome')} /></Campo>
          <Campo label="Cognome" required><Input value={form.cognome} onChange={set('cognome')} /></Campo>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-[13px]">Email <span className="text-destructive">*</span></Label>
            <Input type="email" value={form.email} onChange={e => { set('email')(e); setEmailEsistente(null); }} onBlur={checkEmail} />
            <p className="text-[12px] text-muted-foreground flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0 text-warning" />
              Questa persona non potrà più candidarsi dal form pubblico con questa email: le candidature con un'email già registrata vengono rifiutate.
            </p>
            {emailEsistente && (
              <p className="text-[12px] text-destructive">
                Esiste già una persona con questa email.{' '}
                <Link to={`/admin/studenti/${emailEsistente.id}`} className="underline font-medium">Apri la scheda</Link>
              </p>
            )}
          </div>
          <Campo label="Telefono"><Input value={form.telefono} onChange={set('telefono')} /></Campo>
          <Campo label="Data di nascita"><Input type="date" value={form.data_nascita} onChange={set('data_nascita')} /></Campo>
          <Campo label="Nazionalità">
            <Select value={form.nazionalita} onValueChange={v => setForm(f => ({ ...f, nazionalita: v }))}>
              <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
              <SelectContent>
                {NATIONALITIES.map(n => <SelectItem key={n.code} value={n.it}>{n.it}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Codice fiscale">
            <div className="space-y-1.5">
              <Input value={form.codice_fiscale} disabled={form.cf_non_disponibile}
                onChange={e => { set('codice_fiscale')(e); setCfError(null); }} onBlur={validaCF} />
              {cfError && <p className="text-[12px] text-destructive">{cfError}</p>}
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Checkbox checked={form.cf_non_disponibile}
                  onCheckedChange={v => setForm(f => ({ ...f, cf_non_disponibile: !!v, codice_fiscale: v ? '' : f.codice_fiscale }))} />
                Codice fiscale non disponibile
              </label>
            </div>
          </Campo>
        </div>

        {/* Indirizzo */}
        <div className="grid grid-cols-2 gap-3 border-t pt-3 mt-1">
          <Campo label="Via"><Input value={form.indirizzo_via} onChange={set('indirizzo_via')} /></Campo>
          <Campo label="Civico"><Input value={form.indirizzo_civico} onChange={set('indirizzo_civico')} /></Campo>
          <Campo label="CAP"><Input value={form.indirizzo_cap} onChange={set('indirizzo_cap')} /></Campo>
          <Campo label="Comune"><Input value={form.indirizzo_comune} onChange={set('indirizzo_comune')} /></Campo>
          <Campo label="Nazione">
            <Select value={form.indirizzo_nazione} onValueChange={v => setForm(f => ({ ...f, indirizzo_nazione: v, indirizzo_provincia: '' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.it}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
          {form.indirizzo_nazione === 'IT' && (
            <Campo label="Provincia">
              <Select value={form.indirizzo_provincia} onValueChange={v => setForm(f => ({ ...f, indirizzo_provincia: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>
                  {PROVINCE.map(p => <SelectItem key={p.sigla} value={p.sigla}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
          )}
        </div>

        {/* Posto letto */}
        <div className="border-t pt-3 mt-1 space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2"><BedDouble className="w-4 h-4" /> Assegna subito un posto letto</span>
            <Switch checked={conPosto} onCheckedChange={setConPosto} />
          </label>
          {!conPosto && (
            <p className="text-[12px] text-muted-foreground">
              Senza posto letto la persona entra in lista d'attesa e comparirà in Candidature, non in Residenti.
            </p>
          )}
          {conPosto && (
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Sede" required>
                <Select value={sedeId} onValueChange={v => { setSedeId(v); setCameraId(''); setPosto(''); }}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    {(strutture ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Campo>
              <div />
              <Campo label="Data inizio" required><Input type="date" value={dataInizio} onChange={e => { setDataInizio(e.target.value); setCameraId(''); setPosto(''); }} /></Campo>
              <Campo label="Data fine (facoltativa)"><Input type="date" value={dataFine} min={dataInizio || undefined} onChange={e => { setDataFine(e.target.value); setCameraId(''); setPosto(''); }} /></Campo>
              <Campo label="Camera" required>
                <Select value={cameraId} onValueChange={v => { setCameraId(v); setPosto(''); }} disabled={!sedeId || !dataInizio}>
                  <SelectTrigger><SelectValue placeholder={sedeId && dataInizio ? 'Seleziona' : 'Prima sede e data inizio'} /></SelectTrigger>
                  <SelectContent>
                    {(camereLibere ?? []).map((c: any) => (
                      <SelectItem key={c.camera_id} value={c.camera_id}>
                        Camera {c.numero}{c.piano != null ? ` · piano ${c.piano}` : ''} · {c.tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="Posto" required>
                <Select value={posto} onValueChange={setPosto} disabled={!cameraId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    {postiLiberi.map(n => <SelectItem key={n} value={String(n)}>Posto {n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Campo>
            </div>
          )}
        </div>

        {submitError && (
          <p className="text-[13px] text-destructive bg-destructive/10 rounded-md px-3 py-2">{submitError}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={submit} disabled={!canSubmit || saving}>
            {saving ? 'Salvataggio…' : 'Aggiungi persona'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
