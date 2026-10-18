import { DEFAULT_BUILD_NAME } from '../build/build';
import { deserializeBuild, serializeBuild } from '../build/serialize';
import type { BuildState } from '../build/types';
import type { CarManifest } from '../manifest/types';
import type { GarageSlot, GarageStorage } from './garageStorage';

/** Otomatik kayıt slotu: listede görünmez, sayfa yenilenince son durumu geri getirir. */
export const AUTOSAVE_ID = '__autosave__';
export const SLOT_LIMIT = 24;
export const BUILD_FILE_FORMAT = 'muscle-garage-build';
const NAME_LIMIT = 40;

export type GarageErrorCode =
  'slot_limit' | 'not_found' | 'corrupt' | 'invalid_json' | 'wrong_car' | 'storage';

export class GarageError extends Error {
  constructor(
    readonly code: GarageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GarageError';
  }
}

export const newSlotId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const cleanName = (name: string): string =>
  name.trim().slice(0, NAME_LIMIT) || DEFAULT_BUILD_NAME;

/** Listedeki slotlar: otomatik kayıt hariç, en son güncellenen önce. */
export async function listBuilds(storage: GarageStorage): Promise<GarageSlot[]> {
  const all = await storage.listSlots();
  return all
    .filter((s) => s.id !== AUTOSAVE_ID)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Build'i slota yazar; id verilmezse yeni slot açar (sınır aşılırsa slot_limit). */
export async function saveBuild(
  storage: GarageStorage,
  build: BuildState,
  options: { id?: string; thumbnail?: string | null; now?: Date } = {},
): Promise<GarageSlot> {
  const id = options.id ?? newSlotId();
  if (options.id === undefined) {
    const count = (await listBuilds(storage)).length;
    if (count >= SLOT_LIMIT)
      throw new GarageError('slot_limit', `En fazla ${SLOT_LIMIT} kayıt tutulabilir`);
  }
  const existing = options.id ? await storage.getSlot(options.id) : null;
  const named = { ...build, name: cleanName(build.name) };
  const slot: GarageSlot = {
    id,
    name: named.name,
    carId: named.carId,
    updatedAt: (options.now ?? new Date()).toISOString(),
    // Yeni görsel verilmediyse eskisi korunur
    thumbnail: options.thumbnail !== undefined ? options.thumbnail : (existing?.thumbnail ?? null),
    json: serializeBuild(named),
  };
  try {
    await storage.putSlot(slot);
  } catch (error) {
    throw new GarageError('storage', error instanceof Error ? error.message : 'Kayıt yazılamadı');
  }
  return slot;
}

/** Slottaki JSON'u migration + manifeste göre normalizasyonla BuildState'e çevirir. */
export function buildFromSlot(slot: GarageSlot, manifest: CarManifest): BuildState {
  try {
    return deserializeBuild(slot.json, manifest);
  } catch (error) {
    throw new GarageError('corrupt', error instanceof Error ? error.message : 'Kayıt okunamadı');
  }
}

export async function loadBuildSlot(
  storage: GarageStorage,
  id: string,
  manifest: CarManifest,
): Promise<BuildState> {
  const slot = await storage.getSlot(id);
  if (!slot) throw new GarageError('not_found', 'Kayıt bulunamadı');
  return buildFromSlot(slot, manifest);
}

export const deleteBuildSlot = (storage: GarageStorage, id: string) => storage.removeSlot(id);

export async function saveAutosave(storage: GarageStorage, build: BuildState): Promise<void> {
  const slot: GarageSlot = {
    id: AUTOSAVE_ID,
    name: build.name,
    carId: build.carId,
    updatedAt: new Date().toISOString(),
    thumbnail: null,
    json: serializeBuild(build),
  };
  await storage.putSlot(slot);
}

/** Son oturumun build'i; yoksa ya da bozuksa null (varsayılanla başlanır). */
export async function loadAutosave(
  storage: GarageStorage,
  manifest: CarManifest,
): Promise<BuildState | null> {
  const slot = await storage.getSlot(AUTOSAVE_ID);
  if (!slot) return null;
  try {
    return buildFromSlot(slot, manifest);
  } catch {
    return null;
  }
}

/** Paylaşım için JSON: küçük bir zarf (format + build). */
export function exportBuildJson(build: BuildState): string {
  return JSON.stringify(
    { format: BUILD_FILE_FORMAT, build: JSON.parse(serializeBuild(build)) as unknown },
    null,
    2,
  );
}

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

export function exportFileName(build: BuildState): string {
  const slug = build.name
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (c) => TR_MAP[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'build'}.muscle-garage.json`;
}

/** JSON metninden build: zarflı ya da çıplak BuildState kabul edilir. */
export function importBuildJson(text: string, manifest: CarManifest): BuildState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GarageError('invalid_json', 'Geçerli bir JSON değil');
  }
  const record =
    typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  const inner = record && record.format === BUILD_FILE_FORMAT ? record.build : parsed;
  if (typeof inner !== 'object' || inner === null)
    throw new GarageError('corrupt', 'Build verisi bulunamadı');
  const carId = (inner as Record<string, unknown>).carId;
  if (carId !== manifest.id)
    throw new GarageError('wrong_car', `Bu build "${String(carId)}" aracına ait`);
  try {
    return deserializeBuild(JSON.stringify(inner), manifest);
  } catch (error) {
    throw new GarageError('corrupt', error instanceof Error ? error.message : 'Build okunamadı');
  }
}
