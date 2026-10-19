/** Devir saati kadranı: 270° yay, sol alttan (0 rpm) sağ alta (azami) saat yönünde. */
export const GAUGE_START_DEG = 135;
export const GAUGE_SWEEP_DEG = 270;
/**
 * Vites uyarısı: kırmızı çizginin bu oranında yanar. Otomatik şanzıman %93'te vites büyüttüğü
 * için bunun üstünde olmalı; yoksa her vites değişiminden önce boşuna yanıp söner.
 */
export const SHIFT_LIGHT_FRACTION = 0.97;

export type GaugeScale = {
  /** Kadranın en yüksek değeri (rpm), binliklere yuvarlanmış */
  max: number;
  /** Etiketli büyük çentikler (rpm) */
  majors: number[];
  /** Ara çentikler (rpm) */
  minors: number[];
};

/** Kırmızı çizginin üstünde en az 500 rpm pay bırakan, binlik ölçekli kadran. */
export function gaugeScale(redlineRpm: number): GaugeScale {
  const max = Math.ceil((redlineRpm + 500) / 1000) * 1000;
  const majors: number[] = [];
  const minors: number[] = [];
  for (let r = 0; r <= max; r += 500) (r % 1000 === 0 ? majors : minors).push(r);
  return { max, majors, minors };
}

/** Değerin kadran açısı (derece, SVG: 0 = +x, saat yönü +). Aralık dışı değerler kırpılır. */
export function gaugeAngle(value: number, max: number): number {
  const f = Math.min(1, Math.max(0, value / max));
  return GAUGE_START_DEG + f * GAUGE_SWEEP_DEG;
}

/** Merkez etrafında açı ve yarıçaptaki nokta (SVG koordinatı). */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** İki açı arası saat yönünde yay (SVG path `d`). */
export function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const [x0, y0] = polar(cx, cy, r, fromDeg);
  const [x1, y1] = polar(cx, cy, r, toDeg);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** Vites kutusunda gösterilecek metin. */
export function gearLabel(gear: number, reverse: boolean, speedKmh: number): string {
  if (reverse) return 'R';
  return speedKmh < 1 && gear <= 1 ? 'N' : String(gear);
}
