import { MM_PER_INCH } from './wheels';
import type { BrakeConfig, WheelConfig } from './types';

/**
 * Jant/fren geometrisinin ortak ölçüleri (m). Hem geometri üreticileri hem fitment
 * kontrolü aynı fonksiyonları kullanır ki görüntü ile uyarılar tutarlı olsun.
 *
 * Koordinatlar tekerlek yerel uzayında: orijin = göbek bağlantı yüzeyi,
 * +z = dışarı (araçtan uzağa). Jant merkez hattı z = -ET.
 */
export const WHEEL_DIM = {
  flangeHeight: 0.012,
  flangeWidth: 0.012,
  /** Jant yüzünün (kolların) kalınlığı */
  faceThickness: 0.02,
  /** Göbek pedinin yarıçapı (bijonlar bunun içinde) */
  padRadius: 0.075,
  /** Kol pencerelerinin başladığı yarıçap */
  windowInnerRadius: 0.088,
  /** Kol pencerelerinin jant iç yüzeyinden payı */
  windowOuterMargin: 0.022,
  lugCircleRadius: 0.05715,
  lugCount: 5,
  centerCapRadius: 0.034,
  /** Disk ve kaliperin göbek yüzeyinden içeri kaydırılması */
  discInset: 0.045,
  discThickness: 0.028,
  caliperDepth: 0.075,
  caliperInnerReach: 0.045,
  caliperOuterReach: 0.018,
  /** Kaliper açısal genişliği (rad), piston sayısına göre */
  caliperSpan: { 2: 0.55, 4: 0.8, 6: 1.05 } as Record<number, number>,
} as const;

export const inch = (v: number) => (v * MM_PER_INCH) / 1000;

/** Janta ait türetilmiş ölçüler. */
export function rimMetrics(w: WheelConfig) {
  const rimRadius = inch(w.diameterIn) / 2;
  const halfWidth = inch(w.widthIn) / 2;
  const centerZ = -w.offsetMm / 1000;
  const faceRadius = rimRadius - 0.005;
  // Kolların jant kenarına bağlandığı yer: dış flanştan lip derinliği kadar içeride.
  // Kollar bağlantı pedinin içine (kalipere doğru) bükülemez; bu yüzden gerçek jantlardaki
  // gibi ulaşılabilecek dudak derinliği genişlik ve offset ile sınırlıdır.
  const outerFaceZ = centerZ + halfWidth - WHEEL_DIM.faceThickness;
  const faceEdgeZ = Math.max(0, outerFaceZ - inch(w.lipIn));
  return {
    rimRadius,
    halfWidth,
    centerZ,
    faceRadius,
    windowOuterRadius: faceRadius - WHEEL_DIM.windowOuterMargin,
    /** Kol yüzünün arka tarafının z'si (pedde 0). */
    padZ: 0,
    faceEdgeZ,
    /** Gerçekte elde edilen dudak derinliği (inç). */
    effectiveLipIn: Math.max(0, (outerFaceZ - faceEdgeZ) / inch(1)),
  };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Dish/konkav: kolların arka yüzünün r yarıçapındaki z kayması.
 * Pedde (bağlantı yüzeyi) 0, jant kenarında faceEdgeZ.
 */
export function dishZ(w: WheelConfig, r: number): number {
  const m = rimMetrics(w);
  return m.padZ + (m.faceEdgeZ - m.padZ) * smoothstep(WHEEL_DIM.padRadius, m.faceRadius * 0.95, r);
}

export function brakeMetrics(b: BrakeConfig, discMm: number) {
  const discRadius = discMm / 2000;
  const discZ = -WHEEL_DIM.discInset;
  return {
    discRadius,
    discZ,
    caliperInnerRadius: discRadius - WHEEL_DIM.caliperInnerReach,
    caliperOuterRadius: discRadius + WHEEL_DIM.caliperOuterReach,
    caliperFrontZ: discZ + WHEEL_DIM.caliperDepth / 2,
    caliperSpan: WHEEL_DIM.caliperSpan[b.pistons] ?? WHEEL_DIM.caliperSpan[4] ?? 0.8,
  };
}
