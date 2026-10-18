import { getCar, isCarId } from '../../data/cars';
import type { BuildState } from '../build/types';
import { useBuildStore } from '../store/stores';
import { useGarageStore } from '../store/garageStore';
import {
  LEGACY_STORAGE_KEY,
  sanitizeUserPresets,
  usePaintPresetStore,
  type UserPaintPreset,
} from '../store/paintPresetStore';
import { loadAllAutosaves, saveAutosave } from './garageService';
import type { GarageStorage } from './garageStorage';

export const PRESETS_META_KEY = 'paintPresets';
/** Son seçilen araç (açılışta seçim ekranında vurgulanır) */
export const LAST_CAR_META_KEY = 'lastCarId';
/** Değişiklikten sonra otomatik kayda kadar beklenen süre (ms) */
export const AUTOSAVE_DELAY_MS = 800;

/** Eski sürümde localStorage'a yazılmış boya presetlerini okur (yoksa boş). */
function readLegacyPresets(): UserPaintPreset[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { state?: { presets?: unknown } };
    return sanitizeUserPresets(parsed.state?.presets);
  } catch {
    return [];
  }
}

function clearLegacyPresets(): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // erişilemiyorsa yapacak bir şey yok
  }
}

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let activeStorage: GarageStorage | null = null;
const unsubscribers: (() => void)[] = [];
/** Kullanıcı değişikliği olmayan (araç seçimi/geri yükleme ile konan) build: otomatik kaydı tetiklemez. */
let pristine: BuildState | null = null;

/** Bu build'in store'a konması kullanıcı değişikliği sayılmaz (otomatik kayıt yazmaz). */
export function markPristine(build: BuildState): void {
  pristine = build;
}

const resolveManifest = (carId: string) => (isCarId(carId) ? getCar(carId).manifest : undefined);

/** Otomatik kayıt: build'i diske ve garaj deposundaki "son oturum" özetine yazar. */
async function writeAutosave(storage: GarageStorage, build: BuildState): Promise<void> {
  await saveAutosave(storage, build);
  useGarageStore.getState().setAutosave({ build, updatedAt: new Date().toISOString() });
}

/** Bekleyen otomatik kaydı hemen yazar (sayfa kapanırken, araç değişirken ve testlerde). */
export async function flushAutosave(): Promise<void> {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
    if (activeStorage) await writeAutosave(activeStorage, useBuildStore.getState().build);
  }
}

/** Son seçilen aracı kalıcı olarak anımsar. */
export async function rememberLastCar(carId: string): Promise<void> {
  if (activeStorage) await activeStorage.setMeta(LAST_CAR_META_KEY, carId).catch(() => undefined);
}

/** Kayıtlı son araç (yoksa null). */
export async function readLastCar(storage: GarageStorage): Promise<string | null> {
  const id = await storage.getMeta<string>(LAST_CAR_META_KEY);
  return typeof id === 'string' && isCarId(id) ? id : null;
}

/**
 * Kalıcılığı başlatır: depoyu açar, boya presetlerini yükler (eski localStorage verisini
 * taşıyarak), araç başına son oturumları okur (eski tek slotu göçürerek) ve sonraki
 * kullanıcı değişikliklerini araç başına yazar. Build, araç seçilince (carSession) yüklenir.
 * Birden fazla çağrı tek başlatma sayılır.
 */
export async function initPersistence(storage?: GarageStorage): Promise<void> {
  if (started) return;
  started = true;
  const opened = await useGarageStore.getState().init(storage);
  activeStorage = opened;

  // Boya presetleri
  try {
    let presets = sanitizeUserPresets(await opened.getMeta(PRESETS_META_KEY));
    if (presets.length === 0) {
      const legacy = readLegacyPresets();
      if (legacy.length > 0) {
        presets = legacy;
        await opened.setMeta(PRESETS_META_KEY, presets);
        clearLegacyPresets();
      }
    }
    usePaintPresetStore.getState().replace(presets);
  } catch (error) {
    console.warn('[Garage] Boya presetleri yüklenemedi:', error);
  }
  const stopPresets = usePaintPresetStore.subscribe((state, previous) => {
    if (state.presets !== previous.presets)
      void opened.setMeta(PRESETS_META_KEY, state.presets).catch((e: unknown) => {
        console.warn('[Garage] Boya presetleri yazılamadı:', e);
      });
  });
  unsubscribers.push(stopPresets);

  // Araç başına son oturumlar
  try {
    const all = await loadAllAutosaves(opened, resolveManifest);
    useGarageStore.setState({ autosaves: all });
  } catch (error) {
    console.warn('[Garage] Otomatik kayıtlar okunamadı:', error);
  }

  const stopBuild = useBuildStore.subscribe((state, previous) => {
    if (state.build === previous.build || state.build === pristine) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void writeAutosave(opened, useBuildStore.getState().build).catch((e: unknown) => {
        console.warn('[Garage] Otomatik kayıt yazılamadı:', e);
      });
    }, AUTOSAVE_DELAY_MS);
  });
  unsubscribers.push(stopBuild);

  // Sekme kapanırken/gizlenirken bekleyen kaydı yaz
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushAutosave();
    });
    window.addEventListener('pagehide', () => void flushAutosave());
  }
}

/** Test: başlatma durumunu sıfırlar. */
export function resetPersistenceForTests(): void {
  started = false;
  activeStorage = null;
  pristine = null;
  for (const stop of unsubscribers.splice(0)) stop();
  if (timer !== null) clearTimeout(timer);
  timer = null;
}
