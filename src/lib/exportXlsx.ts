import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export function exportToXlsx(filename: string, rows: Record<string, any>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, filename.slice(0, 31));
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const date = new Date().toISOString().split('T')[0];
  saveAs(new Blob([buf]), `${filename}_${date}.xlsx`);
}

export const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('it-IT') : '';

export const fmtDateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString('it-IT') : '';