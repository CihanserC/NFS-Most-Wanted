/**
 * Prosedürel renk düzenleme (3D LUT). Harici .cube dosyası gerekmeden "atölye" tonu
 * üretir: gölgelerde soğuk (teal), parlak alanlarda sıcak (turuncu) kayma, kontrast ve
 * doygunluk. Girdi ve çıktı sRGB (ton eşleme sonrası, 0..1).
 */
export type GradeParams = {
  /** Gölgelere eklenen renk (sRGB 0..1) ve gücü */
  shadowTint: [number, number, number];
  shadowStrength: number;
  /** Parlak alanlara eklenen renk ve gücü */
  highlightTint: [number, number, number];
  highlightStrength: number;
  /** 1 = değişmez */
  contrast: number;
  /** 1 = değişmez */
  saturation: number;
  /** Siyah seviyesini kaldırma (film hissi), 0 = değişmez */
  lift: number;
};

export const NEUTRAL_GRADE: GradeParams = {
  shadowTint: [0, 0, 0],
  shadowStrength: 0,
  highlightTint: [0, 0, 0],
  highlightStrength: 0,
  contrast: 1,
  saturation: 1,
  lift: 0,
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Tek bir rengi düzenler (LUT ve testler için). */
export function gradeColor(
  rgb: [number, number, number],
  p: GradeParams,
): [number, number, number] {
  let [r, g, b] = rgb;
  // Kontrast: orta griden (0.5) uzaklaştır.
  r = (r - 0.5) * p.contrast + 0.5;
  g = (g - 0.5) * p.contrast + 0.5;
  b = (b - 0.5) * p.contrast + 0.5;
  // Doygunluk: parlaklığa doğru karıştır.
  const l0 = luma(r, g, b);
  r = l0 + (r - l0) * p.saturation;
  g = l0 + (g - l0) * p.saturation;
  b = l0 + (b - l0) * p.saturation;
  // Ayrık tonlama (split toning): gölge ve parlak alanlara ayrı renk.
  const l = clamp01(luma(r, g, b));
  const sw = (1 - l) * (1 - l) * p.shadowStrength;
  const hw = l * l * p.highlightStrength;
  r += (p.shadowTint[0] - 0.5) * sw + (p.highlightTint[0] - 0.5) * hw;
  g += (p.shadowTint[1] - 0.5) * sw + (p.highlightTint[1] - 0.5) * hw;
  b += (p.shadowTint[2] - 0.5) * sw + (p.highlightTint[2] - 0.5) * hw;
  // Lift: siyahları hafifçe kaldır.
  r = p.lift + r * (1 - p.lift);
  g = p.lift + g * (1 - p.lift);
  b = p.lift + b * (1 - p.lift);
  return [clamp01(r), clamp01(g), clamp01(b)];
}

/**
 * size³ RGBA LUT verisi, 0..1 float (postprocessing LookupTexture FloatType bekler;
 * Uint8 veri GPU'da geçersiz doku = siyah ekran). r en hızlı değişen eksen.
 */
export function createGradeLUT(p: GradeParams, size: number): Float32Array {
  const data = new Float32Array(size * size * size * 4);
  let i = 0;
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const [or, og, ob] = gradeColor([r / (size - 1), g / (size - 1), b / (size - 1)], p);
        data[i++] = or;
        data[i++] = og;
        data[i++] = ob;
        data[i++] = 1;
      }
  return data;
}
