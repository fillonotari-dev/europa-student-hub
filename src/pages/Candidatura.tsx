import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Lang, t } from '@/i18n/translations';
import { CheckCircle, Globe, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NATIONALITIES } from '@/lib/nationalities';
import { UNIVERSITIES, COURSE_LEVEL_LABELS, type CourseLevel } from '@/lib/universities';

const STEPS = ['stepPersonal', 'stepAcademic', 'stepPreferences', 'stepDocuments', 'stepReview'] as const;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE = 5 * 1024 * 1024;

export default function Candidatura() {
  const [lang, setLang] = useState<Lang>('it');
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    nome: '', cognome: '', email: '', telefono: '', data_nascita: '', nazionalita: '', codice_fiscale: '',
    universita: UNIVERSITIES.length === 1 ? UNIVERSITIES[0].name : '',
    dipartimento: '', corso_di_studi: '', anno_di_corso: '', matricola: '',
    struttura_preferita_id: '', tipo_camera_preferito: '', periodo_inizio: '', periodo_fine: '',
    anno_accademico: '2025/2026', messaggio: '',
  });
  const [files, setFiles] = useState<{ documento_identita: File | null; certificato_iscrizione: File | null }>({
    documento_identita: null, certificato_iscrizione: null,
  });

  const { data: strutture } = useQuery({
    queryKey: ['strutture-pubbliche'],
    queryFn: async () => {
      const { data } = await supabase.from('strutture').select('id, nome').eq('attiva', true);
      return data ?? [];
    },
  });

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const setUniversita = (value: string) =>
    setForm(f => ({ ...f, universita: value, dipartimento: '', corso_di_studi: '' }));
  const setDipartimento = (value: string) =>
    setForm(f => ({ ...f, dipartimento: value, corso_di_studi: '' }));

  const validateStep = () => {
    const required: Record<number, string[]> = {
      0: ['nome', 'cognome', 'email', 'telefono', 'data_nascita', 'nazionalita', 'codice_fiscale'],
      1: ['universita', 'dipartimento', 'corso_di_studi', 'anno_di_corso', 'matricola'],
      2: ['periodo_inizio', 'periodo_fine', 'anno_accademico'],
      3: [],
    };
    const fields = required[step] || [];
    for (const f of fields) {
      if (!(form as any)[f]) {
        toast({ title: t(lang, 'form.required'), variant: 'destructive' });
        return false;
      }
    }
    if (step === 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast({ title: t(lang, 'form.invalidEmail'), variant: 'destructive' });
      return false;
    }
    return true;
  };

  const next = () => { if (validateStep()) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const handleFile = (key: keyof typeof files, file: File | null) => {
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: 'Formato non supportato', variant: 'destructive' });
      return;
    }
    if (file && file.size > MAX_SIZE) {
      toast({ title: 'File troppo grande (max 5 MB)', variant: 'destructive' });
      return;
    }
    setFiles(f => ({ ...f, [key]: file }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const tempId = crypto.randomUUID();
      const uploadedDocs: { tipo: string; nome_file: string; url: string }[] = [];

      for (const [tipo, file] of Object.entries(files)) {
        if (!file) continue;
        const path = `${tempId}/${tipo}/${file.name}`;
        const { error } = await supabase.storage.from('documenti_studenti').upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('documenti_studenti').getPublicUrl(path);
        uploadedDocs.push({ tipo, nome_file: file.name, url: urlData.publicUrl });
      }

      const { error } = await supabase.functions.invoke('submit-candidatura', {
        body: { ...form, documenti: uploadedDocs, struttura_preferita_id: form.struttura_preferita_id || null },
      });
      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      toast({ title: err.message || 'Errore durante l\'invio', variant: 'destructive' });
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
          <Button onClick={() => { setSuccess(false); setStep(0); setForm(f => ({ ...f, nome: '', cognome: '', email: '' })); }}>
            {t(lang, 'form.newApplication')}
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-primary">Studentato Europa</h1>
            <p className="text-[13px] text-muted-foreground">{t(lang, 'form.subtitle')}</p>
          </div>
          <button onClick={() => setLang(l => l === 'it' ? 'en' : 'it')} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted">
            <Globe className="w-4 h-4" />
            {lang === 'it' ? 'EN' : 'IT'}
          </button>
        </div>
      </header>

      {/* Step indicator */}
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

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            {step === 0 && (
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
              </div>
            )}
            {step === 1 && (
              <div className="space-y-4">
                <UniversitaField lang={lang} value={form.universita} onChange={setUniversita} />
                <DipartimentoField lang={lang} universitaName={form.universita} value={form.dipartimento} onChange={setDipartimento} />
                <CorsoField lang={lang} universitaName={form.universita} dipartimentoName={form.dipartimento} value={form.corso_di_studi} onChange={v => set('corso_di_studi', v)} />
                <Field label={t(lang, 'form.annoCorso')} value={form.anno_di_corso} onChange={v => set('anno_di_corso', v)} required />
                <Field label={t(lang, 'form.matricola')} value={form.matricola} onChange={v => set('matricola', v)} required />
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label>{t(lang, 'form.strutturaPreferita')}</Label>
                  <Select value={form.struttura_preferita_id} onValueChange={v => set('struttura_preferita_id', v)}>
                    <SelectTrigger><SelectValue placeholder={t(lang, 'form.nessuna')} /></SelectTrigger>
                    <SelectContent>
                      {strutture?.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t(lang, 'form.tipoCameraPreferito')}</Label>
                  <Select value={form.tipo_camera_preferito} onValueChange={v => set('tipo_camera_preferito', v)}>
                    <SelectTrigger><SelectValue placeholder={t(lang, 'form.nessuna')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="singola">{t(lang, 'form.singola')}</SelectItem>
                      <SelectItem value="doppia">{t(lang, 'form.doppia')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t(lang, 'form.periodoInizio')} value={form.periodo_inizio} onChange={v => set('periodo_inizio', v)} type="date" required />
                  <Field label={t(lang, 'form.periodoFine')} value={form.periodo_fine} onChange={v => set('periodo_fine', v)} type="date" required />
                </div>
                <Field label={t(lang, 'form.annoAccademico')} value={form.anno_accademico} onChange={v => set('anno_accademico', v)} required />
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4">
                <FileUpload label={t(lang, 'form.documentoIdentita')} hint={t(lang, 'form.uploadHint')} file={files.documento_identita} onChange={f => handleFile('documento_identita', f)} />
                <FileUpload label={t(lang, 'form.certificatoIscrizione')} hint={t(lang, 'form.uploadHint')} file={files.certificato_iscrizione} onChange={f => handleFile('certificato_iscrizione', f)} />
                <div>
                  <Label>{t(lang, 'form.messaggio')}</Label>
                  <Textarea value={form.messaggio} onChange={e => set('messaggio', e.target.value)} placeholder={t(lang, 'form.messaggioPlaceholder')} className="mt-1.5" />
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="space-y-6">
                <ReviewSection title={t(lang, 'form.stepPersonal')} items={[
                  [t(lang, 'form.nome'), `${form.nome} ${form.cognome}`],
                  [t(lang, 'form.email'), form.email],
                  [t(lang, 'form.telefono'), form.telefono],
                  [t(lang, 'form.dataNascita'), form.data_nascita],
                  [t(lang, 'form.nazionalita'), form.nazionalita],
                ]} />
                <ReviewSection title={t(lang, 'form.stepAcademic')} items={[
                  [t(lang, 'form.universita'), form.universita],
                  [t(lang, 'form.dipartimento'), form.dipartimento],
                  [t(lang, 'form.corsoStudi'), form.corso_di_studi],
                  [t(lang, 'form.annoCorso'), form.anno_di_corso],
                  [t(lang, 'form.matricola'), form.matricola],
                ]} />
                <ReviewSection title={t(lang, 'form.stepPreferences')} items={[
                  [t(lang, 'form.strutturaPreferita'), strutture?.find(s => s.id === form.struttura_preferita_id)?.nome || '-'],
                  [t(lang, 'form.tipoCameraPreferito'), form.tipo_camera_preferito || '-'],
                  [t(lang, 'form.periodoInizio'), form.periodo_inizio],
                  [t(lang, 'form.periodoFine'), form.periodo_fine],
                  [t(lang, 'form.annoAccademico'), form.anno_accademico],
                ]} />
                {(files.documento_identita || files.certificato_iscrizione) && (
                  <ReviewSection title={t(lang, 'form.stepDocuments')} items={[
                    [t(lang, 'form.documentoIdentita'), files.documento_identita?.name || '-'],
                    [t(lang, 'form.certificatoIscrizione'), files.certificato_iscrizione?.name || '-'],
                  ]} />
                )}
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
            <Button onClick={handleSubmit} disabled={submitting}>
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

function FileUpload({ label, hint, file, onChange }: { label: string; hint: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => document.getElementById(`file-${label}`)?.click()}>
        <input id={`file-${label}`} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => onChange(e.target.files?.[0] || null)} />
        {file ? (
          <p className="text-[13px] text-foreground font-medium">{file.name}</p>
        ) : (
          <p className="text-[13px] text-muted-foreground">{hint}</p>
        )}
      </div>
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
    () => UNIVERSITIES.map(u => ({ value: u.name, label: u.name })),
    []
  );
  return (
    <Combobox
      lang={lang}
      label={t(lang, 'form.universita')}
      placeholder={t(lang, 'form.selectUniversita')}
      value={value}
      onChange={onChange}
      options={options}
      required
    />
  );
}

function DipartimentoField({ lang, universitaName, value, onChange }: { lang: Lang; universitaName: string; value: string; onChange: (v: string) => void }) {
  const uni = UNIVERSITIES.find(u => u.name === universitaName);
  const options = useMemo<ComboboxOption[]>(
    () =>
      (uni?.departments ?? []).map(d => ({
        value: d.name,
        label: d.name,
        group: d.sede,
        searchKey: `${d.name} ${d.sede}`,
      })),
    [uni]
  );
  return (
    <Combobox
      lang={lang}
      label={t(lang, 'form.dipartimento')}
      placeholder={t(lang, 'form.selectDipartimento')}
      value={value}
      onChange={onChange}
      options={options}
      disabled={!uni}
      required
    />
  );
}

function CorsoField({ lang, universitaName, dipartimentoName, value, onChange }: { lang: Lang; universitaName: string; dipartimentoName: string; value: string; onChange: (v: string) => void }) {
  const uni = UNIVERSITIES.find(u => u.name === universitaName);
  const dip = uni?.departments.find(d => d.name === dipartimentoName);
  const options = useMemo<ComboboxOption[]>(() => {
    const order: CourseLevel[] = ['ciclo_unico', 'triennale', 'professione_sanitaria', 'magistrale'];
    const out: ComboboxOption[] = [];
    if (dip) {
      for (const lvl of order) {
        const courses = dip.courses.filter(c => c.level === lvl);
        const groupLabel = COURSE_LEVEL_LABELS[lvl][lang];
        courses.forEach((c) => {
          out.push({
            value: c.name,
            label: c.name,
            group: groupLabel,
            searchKey: `${c.name} ${groupLabel}`,
          });
        });
      }
    }
    return out;
  }, [dip, lang]);
  return (
    <Combobox
      lang={lang}
      label={t(lang, 'form.corsoStudi')}
      placeholder={t(lang, 'form.selectCorso')}
      value={value}
      onChange={onChange}
      options={options}
      disabled={!dip}
      required
    />
  );
}
