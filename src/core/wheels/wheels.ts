import defaultsJson from '../../data/wheels/defaults.json';
import limitsJson from '../../data/wheels/limits.json';
import stylesJson from '../../data/wheels/styles.json';
import { normalizeHex } from '../color/color';
import {
  CALIPER_PISTONS,
  REAR_ONLY_TIRE_TYPES,
  ROTOR_TYPES,
  TIRE_SIDEWALLS,
  TIRE_TYPES,
  WHEEL_FINISHES,
  WHEEL_STYLES,
  type Axle,
  type BrakeConfig,
  type FitmentState,
  type TireConfig,
  type WheelConfig,
  type WheelFinish,
  type WheelStyle,
} from './types';

export type Range = { min: number; max: number; step: number };
export type StyleRange = { min: number; max: number; default: number };
export type WheelStyleDef = {
  /** Kullanıcı ayarlayabiliyorsa aralık; yoksa null. */
  spokes: StyleRange | null;
  /** Kol sayısı sabitse değeri. */
  fixedSpokes: number | null;
  lipIn: StyleRange;
  defaultFinish: WheelFinish;
};

export const wheelLimits = limitsJson as {
  diameterIn: Range;
  widthIn: Range;
  offsetMm: Range;
  tireWidthMm: Range;
  tireAspect: Range;
  discMm: Range;
  discRimClearanceMm: number;
  stretchRatio: { stretched: number; meaty: number };
};

export const wheelStyles = stylesJson as Record<WheelStyle, WheelStyleDef>;
export const DEFAULT_FITMENT = defaultsJson as FitmentState;

export const MM_PER_INCH = 25.4;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const oneOf = <T>(list: readonly T[], v: unknown, fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

/** Aralığa sıkıştırır ve adıma yuvarlar (adım, min'den itibaren). */
export function quantize(v: number, r: { min: number; max: number; step?: number }): number {
  const clamped = Math.min(r.max, Math.max(r.min, v));
  if (!r.step) return clamped;
  const steps = Math.round((clamped - r.min) / r.step);
  return Number((r.min + steps * r.step).toFixed(6));
}

const num = (v: unknown, fallback: number, r: { min: number; max: number; step?: number }) =>
  quantize(isNum(v) ? v : fallback, r);

/** Kol sayısı stile göre: sabitse sabit değer, değilse aralıkta tam sayı. */
export function spokesFor(style: WheelStyle, requested: number): number {
  const def = wheelStyles[style];
  if (def.fixedSpokes !== null) return def.fixedSpokes;
  if (!def.spokes) return requested;
  return quantize(requested, { ...def.spokes, step: 1 });
}

export function sanitizeWheel(input: unknown, fallback: WheelConfig): WheelConfig {
  const src = isObj(input) ? input : {};
  const style = oneOf(WHEEL_STYLES, src.style, fallback.style);
  const styleDef = wheelStyles[style];
  const color = typeof src.color === 'string' ? normalizeHex(src.color) : null;
  return {
    style,
    diameterIn: num(src.diameterIn, fallback.diameterIn, wheelLimits.diameterIn),
    widthIn: num(src.widthIn, fallback.widthIn, wheelLimits.widthIn),
    offsetMm: num(src.offsetMm, fallback.offsetMm, wheelLimits.offsetMm),
    lipIn: num(src.lipIn, styleDef.lipIn.default, { ...styleDef.lipIn, step: 0.25 }),
    spokes: spokesFor(style, isNum(src.spokes) ? src.spokes : (styleDef.spokes?.default ?? 5)),
    finish: oneOf(WHEEL_FINISHES, src.finish, fallback.finish),
    color: color ?? fallback.color,
    centerCap: typeof src.centerCap === 'boolean' ? src.centerCap : fallback.centerCap,
    lugNuts: typeof src.lugNuts === 'boolean' ? src.lugNuts : fallback.lugNuts,
  };
}

export function sanitizeTire(input: unknown, fallback: TireConfig, axle: Axle): TireConfig {
  const src = isObj(input) ? input : {};
  let type = oneOf(TIRE_TYPES, src.type, fallback.type);
  if (axle === 'front' && REAR_ONLY_TIRE_TYPES.includes(type)) type = 'street';
  return {
    widthMm: num(src.widthMm, fallback.widthMm, wheelLimits.tireWidthMm),
    aspect: num(src.aspect, fallback.aspect, wheelLimits.tireAspect),
    sidewall: oneOf(TIRE_SIDEWALLS, src.sidewall, fallback.sidewall),
    type,
  };
}

export function sanitizeBrakes(input: unknown, fallback: BrakeConfig): BrakeConfig {
  const src = isObj(input) ? input : {};
  const color = typeof src.caliperColor === 'string' ? normalizeHex(src.caliperColor) : null;
  return {
    discMm: num(src.discMm, fallback.discMm, wheelLimits.discMm),
    rotor: oneOf(ROTOR_TYPES, src.rotor, fallback.rotor),
    pistons: oneOf(CALIPER_PISTONS, src.pistons, fallback.pistons),
    caliperColor: color ?? fallback.caliperColor,
  };
}

/** Bu jant çapına sığan en büyük disk (mm). */
export function maxDiscMm(diameterIn: number): number {
  const max = diameterIn * MM_PER_INCH - wheelLimits.discRimClearanceMm;
  return quantize(Math.floor(max / wheelLimits.discMm.step) * wheelLimits.discMm.step, {
    min: wheelLimits.discMm.min,
    max: wheelLimits.discMm.max,
  });
}

/** Her iki aksa da sığan disk çapı. */
export function effectiveDiscMm(f: FitmentState): number {
  return Math.min(
    f.brakes.discMm,
    maxDiscMm(f.wheels.front.diameterIn),
    maxDiscMm(f.wheels.rear.diameterIn),
  );
}

/** Tüm tekerlek durumunu doğrular; disk küçük janta sığacak şekilde küçültülür. */
export function normalizeFitment(input: unknown): FitmentState {
  const src = isObj(input) ? input : {};
  const wheels = isObj(src.wheels) ? src.wheels : {};
  const tires = isObj(src.tires) ? src.tires : {};
  const d = DEFAULT_FITMENT;
  const out: FitmentState = {
    wheels: {
      front: sanitizeWheel(wheels.front, d.wheels.front),
      rear: sanitizeWheel(wheels.rear, d.wheels.rear),
    },
    tires: {
      front: sanitizeTire(tires.front, d.tires.front, 'front'),
      rear: sanitizeTire(tires.rear, d.tires.rear, 'rear'),
    },
    brakes: sanitizeBrakes(src.brakes, d.brakes),
  };
  out.brakes.discMm = effectiveDiscMm(out);
  return out;
}

/** Lastik dış çapı (mm): jant + 2 × yanak. */
export function tireOuterDiameterMm(rimIn: number, tire: TireConfig): number {
  return rimIn * MM_PER_INCH + 2 * tire.widthMm * (tire.aspect / 100);
}

export const tireOuterRadiusM = (rimIn: number, tire: TireConfig) =>
  tireOuterDiameterMm(rimIn, tire) / 2000;

export type TireLook = 'stretched' | 'normal' | 'meaty';

/** Lastik genişliği / jant genişliği oranına göre görünüm. */
export function tireLook(wheel: WheelConfig, tire: TireConfig): { ratio: number; look: TireLook } {
  const ratio = tire.widthMm / (wheel.widthIn * MM_PER_INCH);
  const { stretched, meaty } = wheelLimits.stretchRatio;
  return { ratio, look: ratio < stretched ? 'stretched' : ratio > meaty ? 'meaty' : 'normal' };
}
