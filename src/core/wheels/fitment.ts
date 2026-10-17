import { inch } from './dimensions';
import type { Axle, FitmentState } from './types';
import { tireOuterRadiusM } from './wheels';

/** Fitment kontrolü için gereken gövde ölçüleri (m). */
export type AxleBody = {
  /** Göbek bağlantı yüzeyinin |x| konumu */
  hubX: number;
  /** Stok lastik yarıçapı (manifestteki tekerlek merkezi yüksekliği) */
  stockRadius: number;
  /** Kemer yarıçapı (tekerlek merkezinden) */
  archRadius: number;
  /** Çamurluk dudağının |x| konumu (flare dahil) */
  fenderX: number;
  /** Tekerlek davlumbazı iç duvarı |x| */
  wellInnerX: number;
};

export type FitmentIssueCode = 'arch_rub' | 'fender_poke' | 'inner_rub';
export type FitmentIssue = { axle: Axle; code: FitmentIssueCode; amountMm: number };

/** Lastiğin dolgun görünümünde yanak taşması (genişlik farkının oranı). */
const MEATY_BULGE_RATIO = 0.15;
/** Bu değerin altındaki temaslar yok sayılır (yuvarlama gürültüsü). */
const TOLERANCE_MM = 1;

/** Lastiğin yanaktan en geniş noktadaki yarı genişliği (m). */
export function tireHalfWidth(f: FitmentState, axle: Axle): number {
  const wheel = f.wheels[axle];
  const tire = f.tires[axle];
  const rimW = inch(wheel.widthIn);
  const tireW = tire.widthMm / 1000;
  const bulge = Math.max(0, tireW - rimW) * MEATY_BULGE_RATIO;
  return Math.max(tireW, rimW) / 2 + bulge;
}

/**
 * Sürtme kontrolü. Engellemez, sadece uyarı listesi döndürür (tuck/poke bilerek yapılabilir).
 * rideHeightMm: negatif = alçaltılmış (Faz 7'de duruş sisteminden gelecek).
 */
export function checkFitment(
  f: FitmentState,
  body: Record<Axle, AxleBody>,
  rideHeightMm: Record<Axle, number> = { front: 0, rear: 0 },
): FitmentIssue[] {
  const issues: FitmentIssue[] = [];
  const push = (axle: Axle, code: FitmentIssueCode, meters: number) => {
    const mm = Math.round(meters * 1000);
    if (mm >= TOLERANCE_MM) issues.push({ axle, code, amountMm: mm });
  };
  for (const axle of ['front', 'rear'] as const) {
    const b = body[axle];
    const wheel = f.wheels[axle];
    const radius = tireOuterRadiusM(wheel.diameterIn, f.tires[axle]);
    // Alçaltma kemer boşluğunu azaltır.
    const archClearance = b.archRadius + rideHeightMm[axle] / 1000;
    push(axle, 'arch_rub', radius - archClearance);

    const centerX = b.hubX - wheel.offsetMm / 1000;
    const half = tireHalfWidth(f, axle);
    push(axle, 'fender_poke', centerX + half - b.fenderX);
    push(axle, 'inner_rub', b.wellInnerX - (centerX - half));
  }
  return issues;
}

/** Lastik büyüklüğüne göre gövdenin aks başına yükselmesi (m) ve öne/arkaya eğim (rad). */
export function bodyLift(
  f: FitmentState,
  stockRadius: Record<Axle, number>,
  wheelbase: number,
): { lift: number; pitch: number; perAxle: Record<Axle, number> } {
  const perAxle = {
    front: tireOuterRadiusM(f.wheels.front.diameterIn, f.tires.front) - stockRadius.front,
    rear: tireOuterRadiusM(f.wheels.rear.diameterIn, f.tires.rear) - stockRadius.rear,
  };
  return {
    perAxle,
    lift: (perAxle.front + perAxle.rear) / 2,
    // Ön yükselince burun kalkar: +z ucunu yukarı almak için negatif x dönüşü.
    pitch: -Math.atan((perAxle.front - perAxle.rear) / wheelbase),
  };
}
