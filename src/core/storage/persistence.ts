import { useBuildStore } from '../store/stores';
import { useGarageStore } from '../store/garageStore';
import {
  LEGACY_STORAGE_KEY,
  sanitizeUserPresets,
  usePaintPresetStore,
  type UserPaintPreset,
} from '../store/paintPresetStore';
import { loadAutosave, saveAutosave } from './garageService';
import type { GarageStorage } from './garageStorage';

export const PRESETS_META_KEY = 'paintPresets';
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

/** Bekleyen otomatik kaydı hemen yazar (sayfa kapanırken ve testlerde). */
export async function flushAutosave(): Promise<void> {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (activeStorage) await saveAutosave(activeStorage, useBuildStore.getState().build);
}

/**
 * Kalıcılığı başlatır: depoyu açar, boya presetlerini yükler (eski localStorage verisini
 * taşıyarak), son oturumun build'ini geri getirir ve sonraki değişiklikleri yazar.
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

  // Son oturum
  try {
    const restored = await loadAutosave(opened, useBuildStore.getState().manifest);
    if (restored) useBuildStore.getState().loadBuild(restored);
  } catch (error) {
    console.warn('[Garage] Otomatik kayıt okunamadı:', error);
  }
  const stopBuild = useBuildStore.subscribe((state, previous) => {
    if (state.build === previous.build) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void saveAutosave(opened, useBuildStore.getState().build).catch((e: unknown) => {
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
  for (const stop of unsubscribers.splice(0)) stop();
  if (timer !== null) clearTimeout(timer);
  timer = null;
}
