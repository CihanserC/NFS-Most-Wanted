/** Sahneden kare alma köprüsü: PhotoBridge (Canvas içinde) kaydolur, arayüz buradan ister. */

export type CaptureOptions = {
  /** Çıktı piksel oranı (CSS pikseline göre); sınırlara göre kırpılır. Verilmezse mevcut. */
  pixelRatio?: number;
};

type CaptureHandler = (options: CaptureOptions) => Promise<HTMLCanvasElement>;

let handler: CaptureHandler | null = null;

export function registerCapture(h: CaptureHandler): () => void {
  handler = h;
  return () => {
    if (handler === h) handler = null;
  };
}

export function captureCanvas(options: CaptureOptions = {}): Promise<HTMLCanvasElement> {
  if (!handler) return Promise.reject(new Error('Sahne henüz hazır değil'));
  return handler(options);
}

/** Tarayıcıların güvenle çizebildiği en büyük kenar ve piksel sayısı. */
export const MAX_SIDE_PX = 8192;
export const MAX_PIXELS = 7680 * 4320;

/** İstenen piksel oranını kenar ve toplam piksel sınırlarına göre kısar. */
export function clampPixelRatio(requested: number, cssWidth: number, cssHeight: number): number {
  const bySide = MAX_SIDE_PX / Math.max(cssWidth, cssHeight);
  const byArea = Math.sqrt(MAX_PIXELS / (cssWidth * cssHeight));
  return Math.max(0.25, Math.min(requested, bySide, byArea));
}

/** Çıktı görselinin piksel boyutu (arayüzde gösterilir). */
export function photoOutputSize(
  requested: number,
  cssWidth: number,
  cssHeight: number,
): { width: number; height: number; ratio: number } {
  const ratio = clampPixelRatio(requested, cssWidth, cssHeight);
  return {
    width: Math.round(cssWidth * ratio),
    height: Math.round(cssHeight * ratio),
    ratio,
  };
}

/** Kaynağı 16:9 küçük resme (kırparak) indirger; JPEG data: URL. */
export function thumbnailDataUrl(source: HTMLCanvasElement, width = 320, height = 180): string {
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  if (!ctx) return '';
  const targetAspect = width / height;
  const sourceAspect = source.width / source.height;
  let sw = source.width;
  let sh = source.height;
  if (sourceAspect > targetAspect) sw = source.height * targetAspect;
  else sh = source.width / targetAspect;
  ctx.drawImage(
    source,
    (source.width - sw) / 2,
    (source.height - sh) / 2,
    sw,
    sh,
    0,
    0,
    width,
    height,
  );
  return out.toDataURL('image/jpeg', 0.78);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Görsel oluşturulamadı'))),
      type,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  // İndirme başladıktan sonra serbest bırak
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Zaman damgalı dosya adı: ad-20261018-153012.png */
export function photoFileName(name: string, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const slug = name
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'muscle-garage'}-${stamp}.png`;
}
