import { loadManifest } from '../../core/manifest/load';
import { loadPartsCatalog, type PartsCatalog } from '../../core/manifest/parts';
import type { CarManifest } from '../../core/manifest/types';
import { createProjectionBox, type ProjectionBox } from '../../core/vinyl/projection';
import {
  createBodySampler,
  parsePlaceholderProfile,
  type BodySampler,
} from '../../car/procedural/profile';
import stallionManifest from './vanta_stallion_70/manifest.json';
import stallionPlaceholder from './vanta_stallion_70/placeholder.json';
import stallionParts from '../parts/vanta_stallion_70.json';
import mustangManifest from './ford_mustang_gt_2013/manifest.json';
import mustangMap from './ford_mustang_gt_2013/modelMap.json';
import mustangPlaceholder from './ford_mustang_gt_2013/placeholder.json';
import mustangParts from '../parts/ford_mustang_gt_2013.json';
import type { ModelMap } from '../../core/model/modelMap';

export type CarDefinition = {
  manifest: CarManifest;
  parts: PartsCatalog;
  /** Prosedürel placeholder gövde örnekleyicisi (model null iken kullanılır). */
  body: BodySampler;
  /** Vinil kutu projeksiyonu (manifest boyutlarından) */
  vinylBox: ProjectionBox;
  /** Gerçek modelin adlarını kurallara uyduran eşleme (kurallara uymayan hazır modeller için) */
  modelMap?: ModelMap;
};

function defineCar(
  manifestJson: unknown,
  placeholderJson: unknown,
  partsJson: unknown,
  modelMap?: ModelMap,
): CarDefinition {
  const manifest = loadManifest(manifestJson, 'manifest.json');
  const profile = parsePlaceholderProfile(placeholderJson, `${manifest.id}/placeholder.json`);
  return {
    manifest,
    parts: loadPartsCatalog(partsJson, manifest),
    body: createBodySampler(manifest, profile),
    vinylBox: createProjectionBox(manifest.dimensions),
    ...(modelMap ? { modelMap } : {}),
  };
}

const definitions: Record<string, CarDefinition> = {};
for (const car of [
  defineCar(stallionManifest, stallionPlaceholder, stallionParts),
  defineCar(mustangManifest, mustangPlaceholder, mustangParts, mustangMap as unknown as ModelMap),
])
  definitions[car.manifest.id] = car;

/** Kayıtlı tüm araçlar (seçim ekranı sırası). */
export function listCars(): CarDefinition[] {
  return Object.values(definitions);
}

/** Test/geliştirme: çalışma zamanında ek araç kaydeder (ör. çok araçlı akış testleri). */
export function registerCarForTests(car: CarDefinition): void {
  definitions[car.manifest.id] = car;
}

export const isCarId = (id: string): boolean => id in definitions;

export const DEFAULT_CAR_ID = 'vanta_stallion_70';

export function getCar(id: string): CarDefinition {
  const car = definitions[id];
  if (!car) throw new Error(`Bilinmeyen araç: ${id}`);
  return car;
}
