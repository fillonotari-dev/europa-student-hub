import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Lang, t } from '@/i18n/translations';
import { CheckCircle, Globe, ChevronRight, ChevronLeft, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import logoStudentato from '@/assets/logo-studentato.svg';

const ALL_STEPS = ['stepLifestyle', 'stepGarante', 'stepDocAggiuntivi', 'stepDichiarazioni', 'stepReview'] as const;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE = 5 * 1024 * 1024;

type TokenState =
  | { status: 'loading' }
  | { status: 'valid'; nome: string; cognome: string; candidaturaId: string; docsPresent: { documento_garante: boolean; documento_aggiuntivo: boolean } }
  | { status: 'invalid'; reason: 'not_found' | 'expired' | 'already_completed' | 'error' };

export default function CandidaturaCompleta() {
  const { token = '' } = useParams<{ token: string }>();
  const [lang, setLang] = useState<Lang>('it');
  const [tokenState, setTokenState] = useState<TokenState>({ status: 'loading' });
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    lingue_parlate: '',
    orari: '',
    personalita: '',
    personalita_altro: '',
    ordine_pulizia: '',
    fumatore: false as boolean,
    presentazione: '',
    garante_nome: '',
    garante_relazione: '',
    garante_telefono: '',
    garante_email: '',
  });
  const [files, setFiles] = useState<{ documento_garante: File | null; documento_aggiuntivo: File | null }>({
    documento_garante: null,
    documento_aggiuntivo: null,
  });
  const [fileErrors, setFileErrors] = useState<Record<string, string | undefined>>({});
  const [dichiarazioni, setDichiarazioni] = useState({
    veridicita: false, privacy: false, info_struttura: false, contatto: false,
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setTokenState({ status: 'invalid', reason: 'not_found' });
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke('get-completion-form', { body: { token } });
        if (cancelled) return;
        if (error || !data?.valid) {
          const reason = data?.reason ?? 'not_found';
          setTokenState({ status: 'invalid', reason });
          return;
        }
        setTokenState({
          status: 'valid',
          nome: data.nome,
          cognome: data.cognome,
          candidaturaId: data.candidatura_id,
          docsPresent: {
            documento_garante: !!data?.documenti_presenti?.documento_garante,
            documento_aggiuntivo: !!data?.documenti_presenti?.documento_aggiuntivo,
          },
        });
      } catch {
        if (!cancelled) setTokenState({ status: 'invalid', reason: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const STEPS = useMemo(() => {
    if (tokenState.status !== 'valid') return ALL_STEPS as readonly string[];
    const dp = tokenState.docsPresent;
    if (dp.documento_garante && dp.documento_aggiuntivo) {
      return ALL_STEPS.filter(s => s !== 'stepDocAggiuntivi');
    }
    return ALL_STEPS as readonly string[];
  }, [tokenState]);
  const stepKey = STEPS[step] as typeof ALL_STEPS[number];

  const validateStep = (): boolean => {
    if (stepKey === 'stepGarante') {
      if (!form.garante_nome.trim() || !form.garante_relazione.trim() || !form.garante_telefono.trim()) {
        toast({ title: t(lang, 'form.required'), variant: 'destructive' });
        return false;
      }
      if (form.garante_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.garante_email)) {
        toast({ title: t(lang, 'form.invalidEmail'), variant: 'destructive' });
        return false;
      }
    }
    if (stepKey === 'stepDichiarazioni') {
      if (!dichiarazioni.veridicita || !dichiarazioni.privacy || !dichiarazioni.info_struttura || !dichiarazioni.contatto) {
        toast({ title: t(lang, 'form.required'), variant: 'destructive' });
        return false;
      }
    }
    return true;
  };

  const next = () => { if (validateStep()) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const validateFile = (file: File | null): string | null => {
    if (!file) return null;
    if (!ACCEPTED_TYPES.includes(file.type)) return t(lang, 'form.fileInvalidType');
    if (file.size > MAX_SIZE) return t(lang, 'form.fileTooLarge');
    return null;
  };
  const handleFile = (key: keyof typeof files, file: File | null) => {
    const err = validateFile(file);
    if (err) {
      setFileErrors(e => ({ ...e, [key]: err }));
      toast({ title: err, variant: 'destructive' });
      return;
    }
    setFileErrors(e => ({ ...e, [key]: undefined }));
    setFiles(f => ({ ...f, [key]: file }));
  };

  const handleSubmit = async () => {
    if (tokenState.status !== 'valid') return;
    setSubmitting(true);
    try {
      const tempId = crypto.randomUUID();
      const uploadedDocs: { tipo: string; nome_file: string; url: string }[] = [];
      for (const [tipo, file] of Object.entries(files)) {
        if (!file) continue;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('tipo', tipo);
        fd.append('temp_id', tempId);
        const { data, error } = await supabase.functions.invoke('upload-candidatura-doc', { body: fd });
        if (error) throw new Error(error.message || 'Errore upload');
        const path = (data as any)?.path;
        const nome = (data as any)?.nome_file;
        if (!path) throw new Error('Risposta upload non valida');
        uploadedDocs.push({ tipo, nome_file: nome ?? file.name, url: path });
      }
      const { data, error } = await supabase.functions.invoke('complete-candidatura', {
        body: {
          token,
          ...form,
          documenti: uploadedDocs,
          dichiarazioni,
        },
      });
      if (error) throw new Error((data as any)?.error || error.message || 'Errore invio');
      if ((data as any)?.error) throw new Error((data as any).error);
      setSuccess(true);
    } catch (err: any) {
      toast({ title: err.message || 'Errore durante l\'invio', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (tokenState.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tokenState.status === 'invalid') {
    const { reason } = tokenState;
    const titleKey = reason === 'already_completed' ? 'form.tokenAlreadyUsed'
      : reason === 'expired' ? 'form.tokenExpired'
      : 'form.tokenInvalid';
    const descKey = reason === 'already_completed' ? 'form.tokenAlreadyUsedDesc'
      : reason === 'expired' ? 'form.tokenExpiredDesc'
      : 'form.tokenInvalidDesc';
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold mb-2">{t(lang, titleKey)}</h1>
          <p className="text-muted-foreground text-[13px]">{t(lang, descKey)}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-xl font-bold mb-2">{t(lang, 'form.successTitle')}</h1>
          <p className="text-muted-foreground text-[13px] mb-6">{t(lang, 'form.completaSuccess')}</p>
          <Button onClick={() => { window.location.href = 'https://www.studentatoeuropa.it'; }}>
            {t(lang, 'form.newApplication')}
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoStudentato} alt="Studentato Europa" className="w-8 h-8 object-contain shrink-0" />
            <div>
              <h1 className="text-lg font-bold text-primary">{t(lang, 'form.completaTitle')}</h1>
              <p className="text-[13px] text-muted-foreground">
                {t(lang, 'form.completaSubtitle').replace('{nome}', tokenState.nome || '')}
              </p>
            </div>
          </div>
          <button onClick={() => setLang(l => l === 'it' ? 'en' : 'it')} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted">
            <Globe className="w-4 h-4" />
            {lang === 'it' ? 'EN' : 'IT'}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-2">
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-border'}`} />
              <p className={`text-[11px] mt-1 ${i === step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {t(lang, `form.${s}`)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            {stepKey === 'stepLifestyle' && (
              <div className="space-y-4">
                <div>
                  <Label>{t(lang, 'form.lingueParlate')}</Label>
                  <Input value={form.lingue_parlate} onChange={e => set('lingue_parlate', e.target.value)} className="mt-1.5" maxLength={300} />
                </div>
                <div>
                  <Label>{t(lang, 'form.orariPrevalenti')}</Label>
                  <Select value={form.orari} onValueChange={v => set('orari', v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder={t(lang, 'form.selectOption')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mattiniero">{t(lang, 'form.orariMattiniero')}</SelectItem>
                      <SelectItem value="serale">{t(lang, 'form.orariSerale')}</SelectItem>
                      <SelectItem value="variabile">{t(lang, 'form.orariVariabile')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t(lang, 'form.personalita')}</Label>
                  <Select value={form.personalita} onValueChange={v => set('personalita', v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder={t(lang, 'form.selectOption')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tranquilla">{t(lang, 'form.persTranquilla')}</SelectItem>
                      <SelectItem value="socievole">{t(lang, 'form.persSocievole')}</SelectItem>
                      <SelectItem value="riservata">{t(lang, 'form.persRiservata')}</SelectItem>
                      <SelectItem value="altro">{t(lang, 'form.persAltro')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.personalita === 'altro' && (
                    <Input
                      className="mt-2"
                      placeholder={t(lang, 'form.tipoStudenteAltroPlaceholder')}
                      value={form.personalita_altro}
                      onChange={e => set('personalita_altro', e.target.value)}
                      maxLength={200}
                    />
                  )}
                </div>
                <div>
                  <Label>{t(lang, 'form.ordinePulizia')}</Label>
                  <Select value={form.ordine_pulizia} onValueChange={v => set('ordine_pulizia', v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder={t(lang, 'form.selectOption')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="molto">{t(lang, 'form.ordineMolto')}</SelectItem>
                      <SelectItem value="abbastanza">{t(lang, 'form.ordineAbbastanza')}</SelectItem>
                      <SelectItem value="flessibile">{t(lang, 'form.ordineFlessibile')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between border rounded-lg p-3">
                  <Label className="text-[13px]">{t(lang, 'form.fumatore')}</Label>
                  <Switch checked={form.fumatore} onCheckedChange={v => set('fumatore', v)} />
                </div>
                <div>
                  <Label>{t(lang, 'form.presentazione')}</Label>
                  <Textarea value={form.presentazione} onChange={e => set('presentazione', e.target.value)} placeholder={t(lang, 'form.presentazionePlaceholder')} className="mt-1.5" rows={4} maxLength={2000} />
                </div>
              </div>
            )}

            {stepKey === 'stepGarante' && (
              <div className="space-y-4">
                <p className="text-[13px] text-muted-foreground">{t(lang, 'form.garanteIntro')}</p>
                <div>
                  <Label>{t(lang, 'form.garanteNome')}<span className="text-destructive ml-0.5">*</span></Label>
                  <Input value={form.garante_nome} onChange={e => set('garante_nome', e.target.value)} className="mt-1.5" maxLength={200} />
                </div>
                <div>
                  <Label>{t(lang, 'form.garanteRelazione')}<span className="text-destructive ml-0.5">*</span></Label>
                  <Input value={form.garante_relazione} onChange={e => set('garante_relazione', e.target.value)} className="mt-1.5" maxLength={100} />
                </div>
                <div>
                  <Label>{t(lang, 'form.garanteTelefono')}<span className="text-destructive ml-0.5">*</span></Label>
                  <Input value={form.garante_telefono} onChange={e => set('garante_telefono', e.target.value)} className="mt-1.5" maxLength={30} />
                </div>
                <div>
                  <Label>{t(lang, 'form.garanteEmail')}</Label>
                  <Input type="email" value={form.garante_email} onChange={e => set('garante_email', e.target.value)} className="mt-1.5" maxLength={255} />
                </div>
              </div>
            )}

            {stepKey === 'stepDocAggiuntivi' && (
              <div className="space-y-4">
                {tokenState.status === 'valid' && !tokenState.docsPresent.documento_garante && (
                  <FileUpload label={t(lang, 'form.documentoGarante')} hint={t(lang, 'form.uploadHint')} file={files.documento_garante} error={fileErrors.documento_garante} onChange={f => handleFile('documento_garante', f)} />
                )}
                {tokenState.status === 'valid' && !tokenState.docsPresent.documento_aggiuntivo && (
                  <FileUpload label={t(lang, 'form.documentoAggiuntivo')} hint={t(lang, 'form.uploadHint')} file={files.documento_aggiuntivo} error={fileErrors.documento_aggiuntivo} onChange={f => handleFile('documento_aggiuntivo', f)} />
                )}
              </div>
            )}

            {stepKey === 'stepDichiarazioni' && (
              <div className="space-y-4">
                <p className="text-[13px] text-muted-foreground">{t(lang, 'form.dichiarazioniIntro')}</p>
                {([
                  ['veridicita', 'form.dichVeridicita'],
                  ['privacy', 'form.dichPrivacy'],
                  ['info_struttura', 'form.dichInfoStruttura'],
                  ['contatto', 'form.dichContatto'],
                ] as const).map(([k, key]) => (
                  <label key={k} className="flex items-start gap-3 cursor-pointer border rounded-lg p-3 hover:bg-muted/40 transition-colors">
                    <Checkbox checked={(dichiarazioni as any)[k]} onCheckedChange={(c) => setDichiarazioni(d => ({ ...d, [k]: !!c }))} className="mt-0.5" />
                    <span className="text-[13px] leading-relaxed">{t(lang, key)}</span>
                  </label>
                ))}
              </div>
            )}

            {stepKey === 'stepReview' && (
              <div className="space-y-4">
                <ReviewSection title={t(lang, 'form.stepLifestyle')} items={[
                  [t(lang, 'form.lingueParlate'), form.lingue_parlate],
                  [t(lang, 'form.orariPrevalenti'), form.orari],
                  [t(lang, 'form.personalita'), form.personalita === 'altro' ? form.personalita_altro : form.personalita],
                  [t(lang, 'form.ordinePulizia'), form.ordine_pulizia],
                  [t(lang, 'form.fumatore'), form.fumatore ? t(lang, 'form.yes') : t(lang, 'form.no')],
                ]} />
                <ReviewSection title={t(lang, 'form.stepGarante')} items={[
                  [t(lang, 'form.garanteNome'), form.garante_nome],
                  [t(lang, 'form.garanteRelazione'), form.garante_relazione],
                  [t(lang, 'form.garanteTelefono'), form.garante_telefono],
                  [t(lang, 'form.garanteEmail'), form.garante_email],
                ]} />
                {(files.documento_garante || files.documento_aggiuntivo) && (
                  <ReviewSection title={t(lang, 'form.stepDocAggiuntivi')} items={[
                    [t(lang, 'form.documentoGarante'), files.documento_garante?.name || '-'],
                    [t(lang, 'form.documentoAggiuntivo'), files.documento_aggiuntivo?.name || '-'],
                  ]} />
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-8">
          <Button variant="outline" onClick={prev} disabled={step === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> {t(lang, 'form.prev')}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>
              {t(lang, 'form.next')} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? t(lang, 'form.submitting') : t(lang, 'form.submit')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FileUpload({ label, hint, file, error, onChange }: { label: string; hint: string; file: File | null; error?: string; onChange: (f: File | null) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className={cn('mt-1.5 border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer', error && 'border-destructive')} onClick={() => document.getElementById(`file-${label}`)?.click()}>
        <input id={`file-${label}`} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => onChange(e.target.files?.[0] || null)} />
        {file ? (
          <p className="text-[13px] text-foreground font-medium">{file.name}</p>
        ) : (
          <p className="text-[13px] text-muted-foreground">{hint}</p>
        )}
      </div>
      {error && <p className="text-[12px] text-destructive mt-1">{error}</p>}
    </div>
  );
}

function ReviewSection({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map(([label, value]) => (
          <div key={label} className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value || '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}