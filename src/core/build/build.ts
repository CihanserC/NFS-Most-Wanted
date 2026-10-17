import type { CarManifest } from '../manifest/types';
import { normalizePaintMap } from '../paint/paint';
import type { PaintConfig } from '../paint/types';
import { CURRENT_BUILD_VERSION, type BuildState } from './types';

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
