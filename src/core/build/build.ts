import type { CarManifest } from '../manifest/types';
import { normalizePaintMap } from '../paint/paint';
import type { PaintConfig } from '../paint/types';
import type { FitmentState } from '../wheels/types';
import { normalizeFitment } from '../wheels/wheels';
import { normalizePerformance, type PerformanceConfig } from '../performance/performance';
import { normalizeGlass, normalizeLighting, normalizeStance } from '../stance/stance';
import { CURRENT_BUILD_VERSION, type BuildState, type LookFields } from './types';

export const DEFAULT_BUILD_NAME = 'Yeni Proje';

export function defaultParts(manifest: CarManifest): Record<string, string> {
  return Object.fromEntries(Object.entries(manifest.slots).map(([id, s]) => [id, s.default]));
}

export function createDefaultBuild(manifest: CarManifest, now = new Date()): BuildState {
  return {
    version: CURRENT_BUILD_VERSION,
    carId: manifest.id,
    name: DEFAULT_BUILD_NAME,
    parts: defaultParts(manifest),
    paint: normalizePaintMap({}, manifest.paintZones),
    ...normalizeFitment(manifest.defaultFitment ?? {}),
    vinyl: [],
    stance: normalizeStance({}),
    glass: normalizeGlass({}),
    lighting: normalizeLighting({}),
    performance: normalizePerformance({}),
    updatedAt: now.toISOString(),
  };
}

/**
 * Build'i manifeste uydurur: eksik slotlara varsayılanı koyar, manifestte olmayan
 * slot/seçenekleri atar. Manifest değiştiğinde eski kayıtlar böylece bozulmaz.
 */
export function normalizeParts(
  parts: Record<string, string>,
  manifest: CarManifest,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [slotId, slot] of Object.entries(manifest.slots)) {
    const chosen = parts[slotId];
    out[slotId] = chosen !== undefined && slot.options.includes(chosen) ? chosen : slot.default;
  }
  return out;
}

export function isValidPart(manifest: CarManifest, slotId: string, optionId: string): boolean {
  return manifest.slots[slotId]?.options.includes(optionId) ?? false;
}

export function withPart(
  build: BuildState,
  slotId: string,
  optionId: string,
  now = new Date(),
): BuildState {
  return { ...build, parts: { ...build.parts, [slotId]: optionId }, updatedAt: now.toISOString() };
}

export function withPaint(
  build: BuildState,
  paint: Record<string, PaintConfig>,
  now = new Date(),
): BuildState {
  return { ...build, paint: { ...build.paint, ...paint }, updatedAt: now.toISOString() };
}

export function fitmentOf(build: Pick<BuildState, 'wheels' | 'tires' | 'brakes'>): FitmentState {
  return { wheels: build.wheels, tires: build.tires, brakes: build.brakes };
}

/** Kısmi tekerlek değişikliğini uygular; sonuç her zaman normalize edilmiş olur. */
export function withFitment(
  build: BuildState,
  patch: Partial<FitmentState>,
  now = new Date(),
): BuildState {
  return {
    ...build,
    ...normalizeFitment({ ...fitmentOf(build), ...patch }),
    updatedAt: now.toISOString(),
  };
}

export function withVinyl(
  build: BuildState,
  vinyl: BuildState['vinyl'],
  now = new Date(),
): BuildState {
  return { ...build, vinyl, updatedAt: now.toISOString() };
}

/** Duruş / cam / ışık alanlarını normalize ederek uygular. */
export function normalizeLook(patch: Partial<LookFields>, base: LookFields): LookFields {
  return {
    stance: normalizeStance(patch.stance ?? base.stance),
    glass: normalizeGlass(patch.glass ?? base.glass),
    lighting: normalizeLighting(patch.lighting ?? base.lighting),
  };
}

export function withLook(
  build: BuildState,
  patch: Partial<LookFields>,
  now = new Date(),
): BuildState {
  return { ...build, ...normalizeLook(patch, build), updatedAt: now.toISOString() };
}

export function withPerformance(
  build: BuildState,
  patch: Partial<PerformanceConfig>,
  now = new Date(),
): BuildState {
  return {
    ...build,
    performance: normalizePerformance({ ...build.performance, ...patch }),
    updatedAt: now.toISOString(),
  };
}
