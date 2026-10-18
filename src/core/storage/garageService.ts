import { DEFAULT_BUILD_NAME } from '../build/build';
import { deserializeBuild, serializeBuild } from '../build/serialize';
import type { BuildState } from '../build/types';
import type { CarManifest } from '../manifest/types';
import type { GarageSlot, GarageStorage } from './garageStorage';

/**
 * Otomatik kayıt slotları (araç başına bir tane): listede görünmez, aracı yeniden seçince
 * son oturumu geri getirir. Eski sürümün tek slotu (AUTOSAVE_ID) açılışta araç başına slota taşınır.
 */
export const AUTOSAVE_ID = '__autosave__';
export const AUTOSAVE_PREFIX = AUTOSAVE_ID;
export const autosaveId = (carId: string): string => `${AUTOSAVE_PREFIX}:${carId}`;
export const isAutosaveId = (id: string): boolean => id.startsWith(AUTOSAVE_PREFIX);
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
    .filter((s) => !isAutosaveId(s.id))
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
    id: autosaveId(build.carId),
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
  const slot =
    (await storage.getSlot(autosaveId(manifest.id))) ??
    // Eski sürümün tek slotu: yalnızca bu araca aitse kullanılır
    (await storage
      .getSlot(AUTOSAVE_ID)
      .then((legacy) => (legacy?.carId === manifest.id ? legacy : null)));
  if (!slot) return null;
  try {
    return buildFromSlot(slot, manifest);
  } catch {
    return null;
  }
}

export type AutosaveEntry = { build: BuildState; updatedAt: string };

/**
 * Tüm araçların otomatik kayıtları (araç kimliği -> kayıt). Bozuk ya da tanınmayan araca ait
 * kayıtlar atlanır. Eski tek slot, ait olduğu araca taşınır (yeni slota yazılır, eski silinir).
 */
export async function loadAllAutosaves(
  storage: GarageStorage,
  resolveManifest: (carId: string) => CarManifest | undefined,
): Promise<Record<string, AutosaveEntry>> {
  const result: Record<string, AutosaveEntry> = {};
  const slots = (await storage.listSlots()).filter((s) => isAutosaveId(s.id));
  // Yeni biçim önce, eski tek slot yalnızca boşluğu doldurur
  slots.sort((x, y) => Number(x.id === AUTOSAVE_ID) - Number(y.id === AUTOSAVE_ID));
  for (const slot of slots) {
    const manifest = resolveManifest(slot.carId);
    if (!manifest) continue;
    try {
      const build = buildFromSlot(slot, manifest);
      if (slot.id === AUTOSAVE_ID) {
        if (!result[manifest.id]) {
          result[manifest.id] = { build, updatedAt: slot.updatedAt };
          await storage.putSlot({ ...slot, id: autosaveId(manifest.id) });
        }
        await storage.removeSlot(AUTOSAVE_ID);
      } else result[manifest.id] = { build, updatedAt: slot.updatedAt };
    } catch {
      // bozuk kayıt: atla
    }
  }
  return result;
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
export function importBuildJson(
  text: string,
  manifestOrResolver: CarManifest | ((carId: string) => CarManifest | undefined),
): BuildState {
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
  const manifest =
    typeof manifestOrResolver === 'function'
      ? typeof carId === 'string'
        ? manifestOrResolver(carId)
        : undefined
      : manifestOrResolver.id === carId
        ? manifestOrResolver
        : undefined;
  if (!manifest) throw new GarageError('wrong_car', `Bu build "${String(carId)}" aracına ait`);
  try {
    return deserializeBuild(JSON.stringify(inner), manifest);
  } catch (error) {
    throw new GarageError('corrupt', error instanceof Error ? error.message : 'Build okunamadı');
  }
}
