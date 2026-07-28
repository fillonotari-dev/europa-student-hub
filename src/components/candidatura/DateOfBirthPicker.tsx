import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lang, t } from '@/i18n/translations';

const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Data di nascita come tre Select (giorno / mese / anno). Emette YYYY-MM-DD o ''.
// Anni da currentYear-16 (età minima) fino al 1900, in ordine decrescente.
// Il giorno viene ricomputato in base al mese/anno; se non è più valido, viene azzerato.

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function DateOfBirthPicker({
  lang,
  label,
  value,
  onChange,
  required,
}: {
  lang: Lang;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  // Stato locale per permettere selezioni parziali (l'onChange esterno
  // riceve una data valida solo quando tutti e tre i valori sono presenti).
  const [parts, setParts] = useState(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    return m ? { y: m[1], mo: m[2], d: m[3] } : { y: '', mo: '', d: '' };
  });

  // Sincronizza quando il valore esterno cambia (es. reset del form).
  useEffect(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    const next = m ? { y: m[1], mo: m[2], d: m[3] } : { y: '', mo: '', d: '' };
    setParts((prev) =>
      prev.y === next.y && prev.mo === next.mo && prev.d === next.d ? prev : next,
    );
  }, [value]);

  const monthList = lang === 'it' ? MONTHS_IT : MONTHS_EN;

  const currentYear = new Date().getFullYear();
  const maxYear = currentYear - 16;
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= 1900; y--) arr.push(y);
    return arr;
  }, [maxYear]);

  const daysInMonth = useMemo(() => {
    const y = parseInt(parts.y || String(maxYear), 10);
    const mo = parseInt(parts.mo || '1', 10);
    if (!y || !mo) return 31;
    return new Date(y, mo, 0).getDate();
  }, [parts.y, parts.mo, maxYear]);

  const emit = (y: string, mo: string, d: string) => {
    setParts({ y, mo, d });
    onChange(y && mo && d ? `${y}-${mo}-${d}` : '');
  };

  const handleYear = (y: string) => {
    let d = parts.d;
    if (d && parts.mo) {
      const max = new Date(parseInt(y, 10), parseInt(parts.mo, 10), 0).getDate();
      if (parseInt(d, 10) > max) d = '';
    }
    emit(y, parts.mo, d);
  };
  const handleMonth = (mo: string) => {
    let d = parts.d;
    if (d && parts.y) {
      const max = new Date(parseInt(parts.y, 10), parseInt(mo, 10), 0).getDate();
      if (parseInt(d, 10) > max) d = '';
    }
    emit(parts.y, mo, d);
  };
  const handleDay = (d: string) => emit(parts.y, parts.mo, d);

  return (
    <div>
      <Label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        <Select value={parts.d} onValueChange={handleDay}>
          <SelectTrigger>
            <SelectValue placeholder={t(lang, 'form.dobDay')} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
              <SelectItem key={d} value={pad(d)}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={parts.mo} onValueChange={handleMonth}>
          <SelectTrigger>
            <SelectValue placeholder={t(lang, 'form.dobMonth')} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {monthList.map((name, i) => (
              <SelectItem key={i} value={pad(i + 1)}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={parts.y} onValueChange={handleYear}>
          <SelectTrigger>
            <SelectValue placeholder={t(lang, 'form.dobYear')} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}