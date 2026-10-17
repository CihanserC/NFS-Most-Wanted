import type { CarManifest } from '../manifest/types';
import { DEFAULT_BUILD_NAME, normalizeParts } from './build';
import { normalizePaintMap } from '../paint/paint';
import { normalizeFitment } from '../wheels/wheels';
import { normalizeGlass, normalizeLighting, normalizeStance } from '../stance/stance';
import { sanitizeLayers } from '../vinyl/layers';
import { hasVinylShape } from '../../vinyl/shapes/library';
import { migrateBuild } from './migrate';
import type { BuildState } from './types';

export function serializeBuild(build: BuildState): string {
  return JSON.stringify(build);
}

/** JSON -> migration -> manifeste göre normalize edilmiş BuildState. */
export function deserializeBuild(json: string, manifest: CarManifest): BuildState {
  const migrated = migrateBuild(JSON.parse(json) as unknown);
  if (migrated.carId !== manifest.id)
    throw new Error(`Kayıt "${migrated.carId}" aracına ait, "${manifest.id}" değil`);
  const parts = typeof migrated.parts === 'object' && migrated.parts !== null ? migrated.parts : {};
  return {
    ...migrated,
    name: typeof migrated.name === 'string' ? migrated.name : DEFAULT_BUILD_NAME,
    parts: normalizeParts(parts, manifest),
    paint: normalizePaintMap(migrated.paint, manifest.paintZones),
    ...normalizeFitment(migrated),
    vinyl: sanitizeLayers(migrated.vinyl, hasVinylShape),
    stance: normalizeStance(migrated.stance),
    glass: normalizeGlass(migrated.glass),
    lighting: normalizeLighting(migrated.lighting),
    updatedAt:
      typeof migrated.updatedAt === 'string' ? migrated.updatedAt : new Date().toISOString(),
  };
}
