import perfJson from '../../data/performance/performance.json';
import type { BuildState } from '../build/types';
import type { PartsCatalog } from '../manifest/parts';
import type { TireConfig } from '../wheels/types';

type EngineLevel = keyof typeof perfJson.engine;
type TransmissionId = keyof typeof perfJson.transmission;
type BrakeLevel = keyof typeof perfJson.brakes;
type SuspensionLevel = keyof typeof perfJson.suspension;

/** Basit performans parçaları (§10.3). Süperşarjör, takılı motor görünümünden (blower_v8) gelir. */
export type PerformanceConfig = {
  engine: EngineLevel;
  transmission: TransmissionId;
  brakes: BrakeLevel;
  suspension: SuspensionLevel;
};

export const perfData = perfJson;
export const ENGINE_LEVELS = Object.keys(perfJson.engine) as EngineLevel[];
export const TRANSMISSIONS = Object.keys(perfJson.transmission) as TransmissionId[];
export const BRAKE_LEVELS = Object.keys(perfJson.brakes) as BrakeLevel[];
export const SUSPENSION_LEVELS = Object.keys(perfJson.suspension) as SuspensionLevel[];

const pick = <T extends string>(v: unknown, all: readonly T[], fallback: T): T =>
  typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : fallback;

export function normalizePerformance(input: unknown): PerformanceConfig {
  const src = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const d = perfJson.defaults as PerformanceConfig;
  return {
    engine: pick(src.engine, ENGINE_LEVELS, d.engine),
    transmission: pick(src.transmission, TRANSMISSIONS, d.transmission),
    brakes: pick(src.brakes, BRAKE_LEVELS, d.brakes),
    suspension: pick(src.suspension, SUSPENSION_LEVELS, d.suspension),
  };
}

export type EngineSpec = {
  idleRpm: number;
  redlineRpm: number;
  /** rpm -> motor torku (Nm) */
  torqueAt: (rpm: number) => number;
  gears: readonly number[];
  finalDrive: number;
};

export const hasSupercharger = (parts: Record<string, string>) => parts.engine === 'blower_v8';

const curve = perfJson.torqueCurve as [number, number][];

/** Normalize eğriden doğrusal aradeğerleme (redline oranına göre). */
function curveFactor(fraction: number): number {
  const first = curve[0] as [number, number];
  if (fraction <= first[0]) return first[1] * Math.max(0.35, fraction / first[0]);
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i] as [number, number];
    const [x0, y0] = curve[i - 1] as [number, number];
    if (fraction <= x1) return y0 + ((y1 - y0) * (fraction - x0)) / (x1 - x0);
  }
  return (curve[curve.length - 1] as [number, number])[1];
}

export function engineSpec(perf: PerformanceConfig, supercharged: boolean): EngineSpec {
  const e = perfJson.engine[perf.engine];
  const sc = supercharged ? perfJson.supercharger : null;
  const peak = e.torqueNm * (sc?.torqueMul ?? 1);
  const redline = e.redline + (sc?.redlineAdd ?? 0);
  const t = perfJson.transmission[perf.transmission];
  return {
    idleRpm: perfJson.idleRpm,
    redlineRpm: redline,
    torqueAt: (rpm) => (rpm > redline ? 0 : peak * curveFactor(rpm / redline)),
    gears: t.gears,
    finalDrive: t.finalDrive,
  };
}

/** Beygir gücü: Nm × rpm / 7121 */
export const hpAt = (torqueNm: number, rpm: number) => (torqueNm * rpm) / 7121;

/** Dyno eğrisi: rpm, tork (Nm), beygir. */
export function dynoCurve(
  spec: EngineSpec,
  steps = 24,
): { rpm: number; torque: number; hp: number }[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const rpm = spec.idleRpm + ((spec.redlineRpm - spec.idleRpm) * i) / steps;
    const torque = spec.torqueAt(rpm);
    return { rpm, torque, hp: hpAt(torque, rpm) };
  });
}

/** Lastik tipi ve genişliğinden tutuş katsayıları (1 = referans sokak lastiği, 245 mm). */
export function tireGrip(tire: TireConfig): { lateral: number; longitudinal: number } {
  const base = perfJson.tireGrip[tire.type];
  const width = Math.sqrt(
    Math.min(1.5, Math.max(0.7, tire.widthMm / perfJson.referenceTireWidthMm)),
  );
  return { lateral: base.lateral * width, longitudinal: base.longitudinal * width };
}

/** Aşırı kamber düz yol tutuşunu düşürür; hafif negatif kamber viraj tutuşunu biraz artırır (§10.2). */
export function camberGripFactors(camberDeg: number): { lateral: number; longitudinal: number } {
  const excess = Math.max(0, Math.abs(camberDeg + 1.5) - 2.5);
  return {
    lateral: 1 + (camberDeg < 0 && camberDeg >= -3 ? 0.02 * -camberDeg : 0) - 0.02 * excess,
    longitudinal: 1 - 0.05 * excess,
  };
}

export type BuildStats = {
  hp: number;
  torqueNm: number;
  weightKg: number;
  grip: number;
  braking: number;
};

const sumBy = (
  parts: Record<string, string>,
  catalog: PartsCatalog,
  field: 'weightKg' | 'downforce',
) =>
  Object.entries(parts).reduce(
    (sum, [slot, option]) => sum + (catalog[slot]?.[option]?.[field] ?? 0),
    0,
  );

export const sumPartWeight = (parts: Record<string, string>, catalog: PartsCatalog) =>
  sumBy(parts, catalog, 'weightKg');

/** Gövde kiti ve spoyler katkılarının toplamı (basit downforce katsayısı). */
export const sumDownforce = (parts: Record<string, string>, catalog: PartsCatalog) =>
  sumBy(parts, catalog, 'downforce');

export function buildWeightKg(
  build: Pick<BuildState, 'parts' | 'performance'>,
  catalog: PartsCatalog,
  baseMassKg: number,
): number {
  const p = build.performance;
  return (
    baseMassKg +
    sumPartWeight(build.parts, catalog) +
    perfJson.engine[p.engine].weightKg +
    perfJson.transmission[p.transmission].weightKg +
    perfJson.brakes[p.brakes].weightKg
  );
}

/** UI çubukları için özet istatistikler. */
export function buildStats(
  build: Pick<BuildState, 'parts' | 'performance' | 'tires' | 'stance'>,
  catalog: PartsCatalog,
  baseMassKg: number,
): BuildStats {
  const points = dynoCurve(engineSpec(build.performance, hasSupercharger(build.parts)));
  const front = tireGrip(build.tires.front);
  const rear = tireGrip(build.tires.rear);
  const camber = camberGripFactors(build.stance.camberDeg.front).lateral;
  return {
    hp: Math.max(...points.map((c) => c.hp)),
    torqueNm: Math.max(...points.map((c) => c.torque)),
    weightKg: buildWeightKg(build, catalog, baseMassKg),
    grip: ((front.lateral + rear.lateral) / 2) * camber,
    braking:
      perfJson.brakes[build.performance.brakes].force *
      ((front.longitudinal + rear.longitudinal) / 2),
  };
}

/** Çubuk grafik için 0..1 normalize değer. */
export function statFraction(key: keyof BuildStats, value: number): number {
  const [lo, hi] = perfJson.statRanges[key] as [number, number];
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}
