/**
 * Araca özel sürüş ayarları (`driving.json`). Eksik alanlar varsayılanı alır; aralık dışı değer
 * yükleme anında hata verir (yanlış ayar sessizce fiziği bozmasın).
 */
export type DrivingTuning = {
  /** Yanal tepe tutuş katsayısı (lastik modeli); sokak lastiği ≈ 1.05 */
  lateralMu: number;
  /** Arka lastik kayma açısı çarpanı: büyüdükçe arka daha erken kayar (dönüş eğilimi) */
  rearSlipScale: number;
  /** Lastik gevşeme uzunluğu (m): küçük = keskin, büyük = yumuşak tepki */
  tireRelaxLength: number;
  /** Yanal kuvvetin yatış momentine katkısı: 0 = ağırlık merkezinden, 1 = zeminden */
  rollInfluence: number;
  /** Frenin ön aksa oranı (0..1) */
  frontBrakeBias: number;
  /** El frenindeyken arka tutuş çarpanı */
  handbrakeRearGrip: number;
};

export const DEFAULT_DRIVING: DrivingTuning = {
  lateralMu: 1.05,
  rearSlipScale: 1.3,
  tireRelaxLength: 0.5,
  rollInfluence: 0.15,
  frontBrakeBias: 0.65,
  handbrakeRearGrip: 0.45,
};

const RANGES: Record<keyof DrivingTuning, readonly [number, number]> = {
  lateralMu: [0.6, 1.8],
  rearSlipScale: [0.8, 2],
  tireRelaxLength: [0.1, 2],
  rollInfluence: [0, 1],
  frontBrakeBias: [0.4, 0.85],
  handbrakeRearGrip: [0.1, 1],
};

export function loadDriving(json: unknown, source = 'driving.json'): DrivingTuning {
  if (typeof json !== 'object' || json === null || Array.isArray(json))
    throw new Error(`${source}: nesne bekleniyordu`);
  const raw = json as Record<string, unknown>;
  const out: DrivingTuning = { ...DEFAULT_DRIVING };
  for (const key of Object.keys(raw)) {
    if (!(key in RANGES)) throw new Error(`${source}: bilinmeyen alan "${key}"`);
    const k = key as keyof DrivingTuning;
    const v = raw[key];
    const [lo, hi] = RANGES[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi)
      throw new Error(`${source}: "${key}" ${lo}..${hi} aralığında bir sayı olmalı`);
    out[k] = v;
  }
  return out;
}
