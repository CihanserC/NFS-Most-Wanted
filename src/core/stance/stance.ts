import stanceJson from '../../data/stance/stance.json';
import { normalizeHex } from '../color/color';
import { quantize, type Range } from '../wheels/wheels';
import type { Axle, AxlePair } from '../wheels/types';

/** Süspansiyon duruşu (§5.5): aks başına sürüş yüksekliği, kamber, iz genişliği. */
export type StanceConfig = {
  rideHeightMm: AxlePair<number>;
  camberDeg: AxlePair<number>;
  /** Jant spacer'ı (iz genişliği artışı), aks başına tekerlek başına mm */
  trackMm: AxlePair<number>;
};

/** Cam filmi: 0 = şeffaf, 0.95 = en koyu; renk tonu */
export type GlassConfig = { tint: number; color: string };

export type LightingConfig = {
  headlightColor: string;
  underglow: { enabled: boolean; color: string; intensity: number };
};

type Limits = {
  rideHeightMm: Range;
  camberDeg: Range;
  trackMm: Range;
  tint: Range;
  underglowIntensity: Range;
};

export const stanceData = stanceJson as unknown as {
  limits: Limits;
  defaults: { stance: StanceConfig; glass: GlassConfig; lighting: LightingConfig };
  presets: Record<
    string,
    { rideHeightMm: [number, number]; camberDeg: [number, number]; trackMm: [number, number] }
  >;
  headlightColors: string[];
  underglowColors: string[];
  tintColors: string[];
  underglowRender: {
    decalScale: [number, number];
    decalOpacity: number;
    tubeIntensity: number;
    lightIntensity: number;
    lightDistance: number;
    tubeLength: number;
    tubeRadius: number;
  };
};

export const STANCE_PRESETS = Object.keys(stanceData.presets);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, r: Range) =>
  quantize(typeof v === 'number' && Number.isFinite(v) ? v : fallback, r);
const hex = (v: unknown, fallback: string) =>
  (typeof v === 'string' && normalizeHex(v)) || fallback;

function pair(input: unknown, fallback: AxlePair<number>, r: Range): AxlePair<number> {
  const src = isObj(input) ? input : {};
  return { front: num(src.front, fallback.front, r), rear: num(src.rear, fallback.rear, r) };
}

export function normalizeStance(input: unknown): StanceConfig {
  const src = isObj(input) ? input : {};
  const d = stanceData.defaults.stance;
  const l = stanceData.limits;
  return {
    rideHeightMm: pair(src.rideHeightMm, d.rideHeightMm, l.rideHeightMm),
    camberDeg: pair(src.camberDeg, d.camberDeg, l.camberDeg),
    trackMm: pair(src.trackMm, d.trackMm, l.trackMm),
  };
}

export function normalizeGlass(input: unknown): GlassConfig {
  const src = isObj(input) ? input : {};
  const d = stanceData.defaults.glass;
  return { tint: num(src.tint, d.tint, stanceData.limits.tint), color: hex(src.color, d.color) };
}

export function normalizeLighting(input: unknown): LightingConfig {
  const src = isObj(input) ? input : {};
  const d = stanceData.defaults.lighting;
  const ug = isObj(src.underglow) ? src.underglow : {};
  return {
    headlightColor: hex(src.headlightColor, d.headlightColor),
    underglow: {
      enabled: typeof ug.enabled === 'boolean' ? ug.enabled : d.underglow.enabled,
      color: hex(ug.color, d.underglow.color),
      intensity: num(ug.intensity, d.underglow.intensity, stanceData.limits.underglowIntensity),
    },
  };
}

export function presetStance(id: string): StanceConfig {
  const p = stanceData.presets[id];
  if (!p) return normalizeStance({});
  const ax = ([front, rear]: [number, number]) => ({ front, rear });
  return normalizeStance({
    rideHeightMm: ax(p.rideHeightMm),
    camberDeg: ax(p.camberDeg),
    trackMm: ax(p.trackMm),
  });
}

/** Çamurluk tipine göre izin verilen en fazla spacer (parça kataloğundaki trackWidthLimitMm). */
export function effectiveTrackMm(stance: StanceConfig, axle: Axle, limitMm: number): number {
  return Math.min(stance.trackMm[axle], limitMm);
}

/**
 * Sürüş yüksekliğinden gövdenin tekerleklere göre yükselmesi (m) ve eğimi (rad).
 * Ön aşağı / arka yukarı (rake) burnu aşağı eğer.
 */
export function stanceBodyOffset(
  stance: StanceConfig,
  wheelbase: number,
): { lift: number; pitch: number } {
  const f = stance.rideHeightMm.front / 1000;
  const r = stance.rideHeightMm.rear / 1000;
  return { lift: (f + r) / 2, pitch: -Math.atan((f - r) / wheelbase) };
}

/** Cam filmi koyuluğundan (0..0.95) cam opaklığı; 0.2 varsayılan stok görünümü korur. */
export function glassOpacity(tint: number): number {
  return 0.18 + tint * 0.8;
}
