import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Lang, t } from '@/i18n/translations';
import { CheckCircle, Globe, ChevronRight, ChevronLeft, MapPin, FileText, ShieldCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NATIONALITIES } from '@/lib/nationalities';
import { UNIVERSITIES } from '@/lib/universities';
import logoStudentato from '@/assets/logo-studentato.svg';
import { StepDots } from '@/components/candidatura/StepDots';

const STEPS = ['stepPersonal', 'stepAcademic', 'stepPreferences', 'stepDocuments', 'stepDichiarazioni'] as const;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE = 5 * 1024 * 1024;
const TURNSTILE_SITE_KEY = '0x4AAAAAAD-aYq1jX5cywwnC';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement | string, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
  }
}

export default function Candidatura() {
  const [lang, setLang] = useState<Lang>('it');
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    nome: '', cognome: '', email: '', telefono: '', data_nascita: '', nazionalita: '', codice_fiscale: '',
    indirizzo_residenza: '', documento_identita_n: '',
    universita: UNIVERSITIES.length === 1 ? UNIVERSITIES[0].name : '',
    corso_di_studi: '', anno_di_corso: '',
    tipo_studente: '', tipo_studente_altro: '',
    struttura_preferita_id: '', tipo_camera_preferito: '', periodo_inizio: '', periodo_fine: '',
    messaggio: '',
    data_arrivo_prevista: '', come_conosciuto: '', come_conosciuto_altro: '', preferenze_note: '',
  });
  const [files, setFiles] = useState<{ documento_identita: File | null; certificato_iscrizione: File | null }>({
    documento_identita: null, certificato_iscrizione: null,
  });
  const [dichiarazioni, setDichiarazioni] = useState({
    veridicita: false, privacy: false, info_struttura: false, contatto: false,
  });
  const allDichiarazioniAccettate = dichiarazioni.veridicita && dichiarazioni.privacy && dichiarazioni.info_struttura && dichiarazioni.contatto;
  const [fileErrors, setFileErrors] = useState<{ documento_identita?: string; certificato_iscrizione?: string }>({});
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);

  const { data: strutture } = useQuery({
    queryKey: ['strutture-pubbliche'],
    queryFn: async () => {
      const { data } = await supabase.from('strutture').select('id, nome, indirizzo').eq('attiva', true);
      return data ?? [];
    },
  });

  const stepKey = STEPS[step];

  // Load Turnstile script once at mount
  useEffect(() => {
    const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    if (document.querySelector(`script[src="${SRC}"]`)) return;
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }, []);

  // Mount / unmount Turnstile widget when entering / leaving stepDichiarazioni
  useEffect(() => {
    if (stepKey !== 'stepDichiarazioni') return;
    let cancelled = false;
    let widgetId: string | null = null;

    const tryRender = () => {
      if (cancelled) return;
      if (!window.turnstile || !turnstileContainerRef.current) {
        window.setTimeout(tryRender, 150);
        return;
      }
      try {
        widgetId = window.turnstile.render(turnstileContainerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
        });
        turnstileWidgetIdRef.current = widgetId;
      } catch (e) {
        console.error('Turnstile render error', e);
      }
    };
    tryRender();

    return () => {
      cancelled = true;
      const id = turnstileWidgetIdRef.current;
      if (id && window.turnstile) {
        try { window.turnstile.remove(id); } catch {}
      }
      turnstileWidgetIdRef.current = null;
      setTurnstileToken('');
    };
  }, [stepKey]);

  // Tipi camera disponibili per la struttura selezionata (lettura real-time dal DB)
  const { data: tipiCameraDisponibili } = useQuery({
    queryKey: ['tipi-camera', form.struttura_preferita_id],
    queryFn: async () => {
      if (!form.struttura_preferita_id) return ['singola', 'doppia'];
      const { data } = await supabase
        .from('camere')
        .select('tipo')
        .eq('struttura_id', form.struttura_preferita_id);
      const tipi = Array.from(new Set((data ?? []).map(r => r.tipo))).filter(Boolean);
      return tipi.length > 0 ? tipi : ['singola', 'doppia'];
    },
  });

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  // Reset tipo camera se non più disponibile per la struttura selezionata
  const setStruttura = (value: string) => {
    setForm(f => ({ ...f, struttura_preferita_id: value, tipo_camera_preferito: '' }));
  };

  const setUniversita = (value: string) =>
    setForm(f => ({ ...f, universita: value }));

  const validateStep = () => {
    const requiredByKey: Record<string, string[]> = {
      stepPersonal: ['nome', 'cognome', 'email', 'telefono', 'data_nascita', 'nazionalita', 'codice_fiscale', 'indirizzo_residenza'],
      stepAcademic: ['universita', 'corso_di_studi', 'periodo_inizio', 'periodo_fine'],
      stepPreferences: [],
      stepDocuments: ['_documenti'],
      stepInfoAggiuntive: ['_info_extra'],
      stepDichiarazioni: ['_dichiarazioni'],
    };
    const fields = requiredByKey[stepKey] || [];
    for (const f of fields) {
      if (f === '_documenti') {
        if (!files.documento_identita || !files.certificato_iscrizione) {
          toast({ title: t(lang, 'form.required'), variant: 'destructive' });
          return false;
        }
        continue;
      }
      if (f === '_dichiarazioni') {
        if (!dichiarazioni.veridicita || !dichiarazioni.privacy || !dichiarazioni.info_struttura || !dichiarazioni.contatto) {
          toast({ title: t(lang, 'form.required'), variant: 'destructive' });
          return false;
        }
        if (!turnstileToken) {
          toast({ title: t(lang, 'form.turnstileRequired'), variant: 'destructive' });
          return false;
        }
        continue;
      }
      if (!(form as any)[f]) {
        toast({ title: t(lang, 'form.required'), variant: 'destructive' });
        return false;
      }
    }
    if (stepKey === 'stepPersonal' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast({ title: t(lang, 'form.invalidEmail'), variant: 'destructive' });
      return false;
    }
    if (stepKey === 'stepAcademic') {
      const dInizio = new Date(form.periodo_inizio);
      const dFine = new Date(form.periodo_fine);
      if (isNaN(dInizio.getTime()) || isNaN(dFine.getTime())) {
        toast({ title: t(lang, 'form.invalidDate'), variant: 'destructive' });
        return false;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dInizio < today) {
        toast({ title: t(lang, 'form.periodoInizioPast'), variant: 'destructive' });
        return false;
      }
      if (dFine < dInizio) {
        toast({ title: t(lang, 'form.periodoFineBeforeInizio'), variant: 'destructive' });
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
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      const msg = t(lang, 'form.fileInvalidType');
      setFileErrors(e => ({ ...e, [key]: msg }));
      toast({ title: msg, variant: 'destructive' });
      return;
    }
    if (file && file.size > MAX_SIZE) {
      const msg = t(lang, 'form.fileTooLarge');
      setFileErrors(e => ({ ...e, [key]: msg }));
      toast({ title: msg, variant: 'destructive' });
      return;
    }
    setFileErrors(e => ({ ...e, [key]: undefined }));
    setFiles(f => ({ ...f, [key]: file }));
  };

  const handleSubmit = async () => {
    // Guard: Turnstile token is required before generating temp_id
    if (!turnstileToken) {
      toast({ title: t(lang, 'form.turnstileRequired'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const tempId = crypto.randomUUID();

      // Open authorized session (Turnstile-backed) before any upload
      {
        const { data: sessData, error: sessErr } = await supabase.functions.invoke(
          'open-candidatura-sessione',
          { body: { temp_id: tempId, turnstile_token: turnstileToken } },
        );
        if (sessErr || (sessData as any)?.error) {
          let serverMsg: string | undefined = (sessData as any)?.error;
          if (!serverMsg && sessErr) {
            try { serverMsg = (await (sessErr as any).context?.response?.json())?.error; } catch {}
          }
          throw new Error(serverMsg || t(lang, 'form.submitError'));
        }
      }

      const uploadedDocs: { tipo: string; nome_file: string; url: string }[] = [];

      const uploadViaFunction = async (tipo: string, file: File) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('tipo', tipo);
        fd.append('temp_id', tempId);
        const { data, error } = await supabase.functions.invoke('upload-candidatura-doc', {
          body: fd,
        });
        if (error) throw new Error(error.message || 'Errore upload documento');
        const path = (data as any)?.path as string | undefined;
        const nome = (data as any)?.nome_file as string | undefined;
        if (!path) throw new Error('Risposta upload non valida');
        uploadedDocs.push({ tipo, nome_file: nome ?? file.name, url: path });
      };

      for (const [tipo, file] of Object.entries(files)) {
        if (!file) continue;
        await uploadViaFunction(tipo, file);
      }

      const { data, error } = await supabase.functions.invoke('submit-candidatura', {
        body: {
          ...form,
          temp_id: tempId,
          documenti: uploadedDocs,
          struttura_preferita_id: form.struttura_preferita_id || null,
          lingua: lang,
          dichiarazioni: {
            veridicita: dichiarazioni.veridicita,
            privacy: dichiarazioni.privacy,
            info_struttura: dichiarazioni.info_struttura,
            contatto: dichiarazioni.contatto,
          },
        },
      });
      if (error) {
        let serverMsg: string | undefined = (data as any)?.error;
        if (!serverMsg) {
          try { serverMsg = (await (error as any).context?.response?.json())?.error; } catch {}
        }
        throw new Error(serverMsg || error.message || t(lang, 'form.submitError'));
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      setSuccess(true);
    } catch (err: any) {
      // Turnstile tokens are single-use and get consumed by siteverify.
      // Reset the widget so the user can retry without recompiling the form.
      const id = turnstileWidgetIdRef.current;
      if (id && window.turnstile) {
        try { window.turnstile.reset(id); } catch {}
      }
      setTurnstileToken('');
      toast({
        title: err.message || t(lang, 'form.submitError'),
        description: t(lang, 'form.submitRetryPreserved'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-xl font-bold mb-2">{t(lang, 'form.successTitle')}</h1>
          <p className="text-muted-foreground text-[13px] mb-6">{t(lang, 'form.successMessage')}</p>
          <Button onClick={() => { window.location.href = 'https://www.studentatoeuropa.it'; }}>
            {t(lang, 'form.newApplication')}
          </Button>
        </motion.div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logoStudentato} alt="Studentato Europa" className="w-8 h-8 object-contain shrink-0" />
              <div>
                <h1 className="text-lg font-bold text-primary">Studentato Europa</h1>
                <p className="text-[13px] text-muted-foreground">{t(lang, 'form.subtitle')}</p>
              </div>
            </div>
            <button onClick={() => setLang(l => l === 'it' ? 'en' : 'it')} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted">
              <Globe className="w-4 h-4" />
              {lang === 'it' ? 'EN' : 'IT'}
            </button>
          </div>
        </header>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-2xl mx-auto px-4 py-10"
        >
          <h2 className="text-2xl font-bold mb-2">{t(lang, 'form.introTitle')}</h2>
          <p className="text-muted-foreground text-[14px] mb-8">{t(lang, 'form.introLead')}</p>
          <div className="space-y-4 mb-8">
            {[
              { icon: FileText, title: 'form.introBlock1Title', desc: 'form.introBlock1Desc' },
              { icon: ShieldCheck, title: 'form.introBlock2Title', desc: 'form.introBlock2Desc' },
              { icon: Clock, title: 'form.introBlock3Title', desc: 'form.introBlock3Desc' },
            ].map((b, i) => {
              const Icon = b.icon;
              return (
                <div key={i} className="flex gap-4 p-4 rounded-lg border bg-card">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[14px] mb-1">{t(lang, b.title)}</h3>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">{t(lang, b.desc)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <Button size="lg" className="w-full sm:w-auto" onClick={() => setStarted(true)}>
            {t(lang, 'form.introCta')}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
          <p className="text-[12px] text-muted-foreground mt-4">{t(lang, 'form.introPrivacy')}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoStudentato} alt="Studentato Europa" className="w-8 h-8 object-contain shrink-0" />
            <div>
              <h1 className="text-lg font-bold text-primary">Studentato Europa</h1>
              <p className="text-[13px] text-muted-foreground">{t(lang, 'form.subtitle')}</p>
            </div>
          </div>
          <button onClick={() => setLang(l => l === 'it' ? 'en' : 'it')} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted">
            <Globe className="w-4 h-4" />
            {lang === 'it' ? 'EN' : 'IT'}
          </button>
        </div>
      </header>

      {/* Step indicator */}
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-4">
        <StepDots total={STEPS.length} current={step} />
        <p className="text-center text-[13px] font-medium text-foreground mt-4">
          {t(lang, `form.${stepKey}`)}
        </p>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            {stepKey === 'stepPersonal' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t(lang, 'form.nome')} value={form.nome} onChange={v => set('nome', v)} required />
                  <Field label={t(lang, 'form.cognome')} value={form.cognome} onChange={v => set('cognome', v)} required />
                </div>
                <Field label={t(lang, 'form.email')} value={form.email} onChange={v => set('email', v)} type="email" required />
                <Field label={t(lang, 'form.telefono')} value={form.telefono} onChange={v => set('telefono', v)} required />
                <Field label={t(lang, 'form.dataNascita')} value={form.data_nascita} onChange={v => set('data_nascita', v)} type="date" required />
                <NationalityField lang={lang} label={t(lang, 'form.nazionalita')} value={form.nazionalita} onChange={v => set('nazionalita', v)} required />
                <Field label={t(lang, 'form.codiceFiscale')} value={form.codice_fiscale} onChange={v => set('codice_fiscale', v)} required />
                <Field label={t(lang, 'form.indirizzoResidenza')} value={form.indirizzo_residenza} onChange={v => set('indirizzo_residenza', v)} required />
                <Field label={t(lang, 'form.documentoIdentitaN')} value={form.documento_identita_n} onChange={v => set('documento_identita_n', v)} />
              </div>
            )}
            {stepKey === 'stepAcademic' && (
              <div className="space-y-4">
                <UniversitaField lang={lang} value={form.universita} onChange={setUniversita} />
                <Field label={t(lang, 'form.corsoStudi')} value={form.corso_di_studi} onChange={v => set('corso_di_studi', v)} required />
                <Field label={t(lang, 'form.annoCorso')} value={form.anno_di_corso} onChange={v => set('anno_di_corso', v)} />
                <div>
                  <Label>{t(lang, 'form.tipoStudente')}</Label>
                  <Select value={form.tipo_studente} onValueChange={v => set('tipo_studente', v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder={t(lang, 'form.selectOption')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="universitario">{t(lang, 'form.tipoStudenteUniversitario')}</SelectItem>
                      <SelectItem value="erasmus">{t(lang, 'form.tipoStudenteErasmus')}</SelectItem>
                      <SelectItem value="master">{t(lang, 'form.tipoStudenteMaster')}</SelectItem>
                      <SelectItem value="altro">{t(lang, 'form.tipoStudenteAltro')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.tipo_studente === 'altro' && (
                    <Input
                      className="mt-2"
                      placeholder={t(lang, 'form.tipoStudenteAltroPlaceholder')}
                      value={form.tipo_studente_altro}
                      onChange={e => set('tipo_studente_altro', e.target.value)}
                      maxLength={200}
                    />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t(lang, 'form.periodoInizio')} value={form.periodo_inizio} onChange={v => set('periodo_inizio', v)} type="date" required />
                  <Field label={t(lang, 'form.periodoFine')} value={form.periodo_fine} onChange={v => set('periodo_fine', v)} type="date" required />
                </div>
                <Field label={t(lang, 'form.dataArrivoPrevista')} value={form.data_arrivo_prevista} onChange={v => set('data_arrivo_prevista', v)} type="date" />
              </div>
            )}
            {stepKey === 'stepPreferences' && (
              <div className="space-y-4">
                <div>
                  <Label>{t(lang, 'form.strutturaPreferita')}</Label>
                  <Select value={form.struttura_preferita_id} onValueChange={setStruttura}>
                    <SelectTrigger><SelectValue placeholder={t(lang, 'form.nessuna')} /></SelectTrigger>
                    <SelectContent>
                      {strutture?.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {(() => {
                    const sel = strutture?.find(s => s.id === form.struttura_preferita_id);
                    if (!sel?.indirizzo) return null;
                    return (
                      <p className="mt-1.5 text-[12px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {sel.indirizzo}
                      </p>
                    );
                  })()}
                </div>
                <div>
                  <Label>{t(lang, 'form.tipoCameraPreferito')}</Label>
                  <Select value={form.tipo_camera_preferito} onValueChange={v => set('tipo_camera_preferito', v)}>
                    <SelectTrigger><SelectValue placeholder={t(lang, 'form.nessuna')} /></SelectTrigger>
                    <SelectContent>
                      {(tipiCameraDisponibili ?? []).includes('singola') && (
                        <SelectItem value="singola">{t(lang, 'form.singola')}</SelectItem>
                      )}
                      {(tipiCameraDisponibili ?? []).includes('doppia') && (
                        <SelectItem value="doppia">{t(lang, 'form.doppia')}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t(lang, 'form.preferenzeNote')}</Label>
                  <Textarea value={form.preferenze_note} onChange={e => set('preferenze_note', e.target.value)} placeholder={t(lang, 'form.preferenzeNotePlaceholder')} className="mt-1.5" maxLength={1000} />
                </div>
                <div>
                  <Label>{t(lang, 'form.comeConosciuto')}</Label>
                  <Select value={form.come_conosciuto} onValueChange={v => set('come_conosciuto', v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder={t(lang, 'form.selectOption')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">{t(lang, 'form.comeConosciutoInstagram')}</SelectItem>
                      <SelectItem value="google">{t(lang, 'form.comeConosciutoGoogle')}</SelectItem>
                      <SelectItem value="universita">{t(lang, 'form.comeConosciutoUniversita')}</SelectItem>
                      <SelectItem value="esn">{t(lang, 'form.comeConosciutoEsn')}</SelectItem>
                      <SelectItem value="amici">{t(lang, 'form.comeConosciutoAmici')}</SelectItem>
                      <SelectItem value="sito">{t(lang, 'form.comeConosciutoSito')}</SelectItem>
                      <SelectItem value="altro">{t(lang, 'form.comeConosciutoAltro')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.come_conosciuto === 'altro' && (
                    <Input
                      className="mt-2"
                      placeholder={t(lang, 'form.tipoStudenteAltroPlaceholder')}
                      value={form.come_conosciuto_altro}
                      onChange={e => set('come_conosciuto_altro', e.target.value)}
                      maxLength={200}
                    />
                  )}
                </div>
              </div>
            )}
            {stepKey === 'stepDocuments' && (
              <div className="space-y-4">
                <FileUpload label={t(lang, 'form.documentoIdentita')} hint={t(lang, 'form.uploadHint')} file={files.documento_identita} error={fileErrors.documento_identita} onChange={f => handleFile('documento_identita', f)} required />
                <FileUpload label={t(lang, 'form.certificatoIscrizione')} hint={t(lang, 'form.uploadHint')} file={files.certificato_iscrizione} error={fileErrors.certificato_iscrizione} onChange={f => handleFile('certificato_iscrizione', f)} required />
              </div>
            )}
            {stepKey === 'stepDichiarazioni' && (
              <div className="space-y-4">
                <p className="text-[13px] text-muted-foreground">{t(lang, 'form.dichiarazioniIntro')}</p>
                <DeclCheckbox checked={dichiarazioni.veridicita} onCheckedChange={v => setDichiarazioni(d => ({ ...d, veridicita: v }))} label={t(lang, 'form.dichVeridicita')} />
                <DeclCheckbox checked={dichiarazioni.privacy} onCheckedChange={v => setDichiarazioni(d => ({ ...d, privacy: v }))} label={t(lang, 'form.dichPrivacy')} />
                <DeclCheckbox checked={dichiarazioni.info_struttura} onCheckedChange={v => setDichiarazioni(d => ({ ...d, info_struttura: v }))} label={t(lang, 'form.dichInfoStruttura')} />
                <DeclCheckbox checked={dichiarazioni.contatto} onCheckedChange={v => setDichiarazioni(d => ({ ...d, contatto: v }))} label={t(lang, 'form.dichContatto')} />
                <div className="pt-2 flex justify-center">
                  <div ref={turnstileContainerRef} />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button variant="outline" onClick={prev} disabled={step === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> {t(lang, 'form.prev')}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>
              {t(lang, 'form.next')} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || !allDichiarazioniAccettate || !turnstileToken}>
              {submitting ? t(lang, 'form.submitting') : t(lang, 'form.submit')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <Label>{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} className="mt-1.5" />
    </div>
  );
}

function NationalityField({ lang, label, value, onChange, required }: { lang: Lang; label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const placeholder = lang === 'it' ? 'Seleziona nazionalità' : 'Select nationality';
  const searchPlaceholder = lang === 'it' ? 'Cerca...' : 'Search...';
  const emptyText = lang === 'it' ? 'Nessun risultato' : 'No results';
  return (
    <div>
      <Label>{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('mt-1.5 w-full justify-between font-normal', !value && 'text-muted-foreground')}
          >
            {value || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {NATIONALITIES.map(n => {
                  const display = lang === 'it' ? n.it : n.en;
                  return (
                    <CommandItem
                      key={n.code}
                      value={`${n.it} ${n.en}`}
                      onSelect={() => { onChange(display); setOpen(false); }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', value === display ? 'opacity-100' : 'opacity-0')} />
                      {display}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FileUpload({ label, hint, file, error, onChange, required }: { label: string; hint: string; file: File | null; error?: string; onChange: (f: File | null) => void; required?: boolean }) {
  return (
    <div>
      <Label>{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
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

type ComboboxOption = { value: string; label: string; group?: string; searchKey?: string };

function Combobox({ lang, label, placeholder, value, onChange, options, disabled, required }: {
  lang: Lang;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: ComboboxOption[];
  disabled?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => {
    return options.reduce<Record<string, ComboboxOption[]>>((acc, o) => {
      const k = o.group || '__';
      (acc[k] ||= []).push(o);
      return acc;
    }, {});
  }, [options]);
  const groupKeys = Object.keys(grouped);
  const selectedLabel = options.find(o => o.value === value)?.label;
  return (
    <div>
      <Label>{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            aria-expanded={open}
            className={cn('mt-1.5 w-full justify-between font-normal', !value && 'text-muted-foreground')}
          >
            <span className="truncate text-left">{selectedLabel || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <Command key={open ? 'open' : 'closed'}>
            <CommandInput placeholder={t(lang, 'form.searchPlaceholder')} />
            <CommandList>
              <CommandEmpty>{t(lang, 'form.noResults')}</CommandEmpty>
              {groupKeys.map(gk => (
                <CommandGroup key={gk} heading={gk === '__' ? undefined : gk}>
                  {grouped[gk].map(o => (
                    <CommandItem
                      key={`${gk}-${o.value}`}
                      value={`${gk}::${o.value}`}
                      keywords={[o.label, o.group ?? '', o.searchKey ?? '']}
                      onSelect={() => { onChange(o.value); setOpen(false); }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
                      {o.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function UniversitaField({ lang, value, onChange }: { lang: Lang; value: string; onChange: (v: string) => void }) {
  const options = useMemo<ComboboxOption[]>(
    () => [
      ...UNIVERSITIES.map(u => ({ value: u.name, label: u.name })),
      { value: '__altra__', label: t(lang, 'form.altraUniversita') },
    ],
    []
  );
  const knownNames = useMemo(() => new Set(UNIVERSITIES.map(u => u.name)), []);
  const isAltra = value !== '' && !knownNames.has(value);
  const [showAltra, setShowAltra] = useState(isAltra);
  const selectValue = showAltra || isAltra ? '__altra__' : value;
  return (
    <div className="space-y-2">
      <Combobox
        lang={lang}
        label={t(lang, 'form.universita')}
        placeholder={t(lang, 'form.selectUniversita')}
        value={selectValue}
        onChange={v => {
          if (v === '__altra__') {
            setShowAltra(true);
            onChange('');
          } else {
            setShowAltra(false);
            onChange(v);
          }
        }}
        options={options}
        required
      />
      {(showAltra || isAltra) && (
        <Input
          placeholder={t(lang, 'form.altraUniversitaPlaceholder')}
          value={isAltra ? value : ''}
          onChange={e => onChange(e.target.value)}
          maxLength={200}
        />
      )}
    </div>
  );
}

function CustomFieldRenderer({
  lang, campo, value, onChange,
}: {
  lang: Lang;
  campo: CampoCustom;
  value: any;
  onChange: (v: any) => void;
}) {
  const lab = labelOf(lang, campo.label_it, campo.label_en);
  const desc = labelOf(lang, campo.descrizione_it ?? '', campo.descrizione_en ?? '');
  const opts = campo.opzioni ?? [];

  const renderControl = () => {
    switch (campo.tipo) {
      case 'text':
        return <Input value={value ?? ''} onChange={e => onChange(e.target.value)} className="mt-1.5" maxLength={500} />;
      case 'number':
        return <Input type="number" value={value ?? ''} onChange={e => onChange(e.target.value)} className="mt-1.5" />;
      case 'date':
        return <Input type="date" value={value ?? ''} onChange={e => onChange(e.target.value)} className="mt-1.5" />;
      case 'textarea':
        return <Textarea value={value ?? ''} onChange={e => onChange(e.target.value)} className="mt-1.5" maxLength={2000} rows={3} />;
      case 'boolean':
        return (
          <div className="mt-2 flex items-center gap-2">
            <Switch checked={!!value} onCheckedChange={onChange} />
            <span className="text-[13px] text-muted-foreground">{value ? t(lang, 'form.yes') : t(lang, 'form.no')}</span>
          </div>
        );
      case 'select':
        return (
          <Select value={value ?? ''} onValueChange={onChange}>
            <SelectTrigger className="mt-1.5"><SelectValue placeholder={t(lang, 'form.selectOption')} /></SelectTrigger>
            <SelectContent>
              {opts.map(o => (
                <SelectItem key={o.value} value={o.value}>{labelOf(lang, o.label_it, o.label_en)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'multiselect': {
        const arr: string[] = Array.isArray(value) ? value : [];
        const toggle = (val: string, on: boolean) => {
          const next = on ? Array.from(new Set([...arr, val])) : arr.filter(x => x !== val);
          onChange(next);
        };
        return (
          <div className="mt-2 space-y-2">
            {opts.length === 0 && <p className="text-[12px] text-muted-foreground">{t(lang, 'form.noOption')}</p>}
            {opts.map(o => {
              const checked = arr.includes(o.value);
              return (
                <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={checked} onCheckedChange={(c) => toggle(o.value, !!c)} />
                  <span className="text-[13px]">{labelOf(lang, o.label_it, o.label_en)}</span>
                </label>
              );
            })}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div>
      <Label>
        {lab}
        {campo.obbligatorio && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {desc && <p className="text-[12px] text-muted-foreground mt-1">{desc}</p>}
      {renderControl()}
    </div>
  );
}

function formatCustomValue(lang: Lang, campo: CampoCustom, value: any): string {
  if (value === undefined || value === null || value === '') return '-';
  if (campo.tipo === 'boolean') return value ? t(lang, 'form.yes') : t(lang, 'form.no');
  if (campo.tipo === 'select') {
    const o = (campo.opzioni ?? []).find(x => x.value === value);
    return o ? labelOf(lang, o.label_it, o.label_en) : String(value);
  }
  if (campo.tipo === 'multiselect') {
    if (!Array.isArray(value) || value.length === 0) return '-';
    return value
      .map(v => {
        const o = (campo.opzioni ?? []).find(x => x.value === v);
        return o ? labelOf(lang, o.label_it, o.label_en) : String(v);
      })
      .join(', ');
  }
  return String(value);
}

function DeclCheckbox({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer border rounded-lg p-3 hover:bg-muted/40 transition-colors">
      <Checkbox checked={checked} onCheckedChange={(c) => onCheckedChange(!!c)} className="mt-0.5" />
      <span className="text-[13px] leading-relaxed">{label} <span className="text-destructive">*</span></span>
    </label>
  );
}
