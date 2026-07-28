// Ridimensionamento immagini lato client prima dell'upload.
// - PDF: passthrough (non modificato).
// - Immagini (compreso HEIC/HEIF su Safari, se decodificabili): decode → canvas
//   con lato max 2000 px → JPEG q=0.8, restituito come File `.jpg`.
// - Se il decode fallisce (es. HEIC su Chrome/Firefox) lancia IMAGE_DECODE_FAILED
//   così il chiamante può mostrare un toast dedicato.

export const IMAGE_DECODE_FAILED = 'IMAGE_DECODE_FAILED';
const MAX_SIDE = 2000;
const JPEG_QUALITY = 0.8;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(IMAGE_DECODE_FAILED));
    };
    img.src = url;
  });
}

function stripExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

export async function resizeImageIfNeeded(file: File): Promise<File> {
  if (file.type === 'application/pdf') return file;
  if (!file.type.startsWith('image/')) return file;

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    throw new Error(IMAGE_DECODE_FAILED);
  }

  const { width: w0, height: h0 } = img;
  if (!w0 || !h0) throw new Error(IMAGE_DECODE_FAILED);

  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(IMAGE_DECODE_FAILED);
  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY)
  );
  if (!blob) throw new Error(IMAGE_DECODE_FAILED);

  return new File([blob], `${stripExt(file.name)}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}