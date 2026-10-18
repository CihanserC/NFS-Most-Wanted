import { createDefaultBuild } from '../build/build';
import type { BuildState } from '../build/types';
import { flushAutosave, markPristine, rememberLastCar } from '../storage/persistence';
import { getCar } from '../../data/cars';
import { useAppStore } from './appStore';
import { useGarageStore } from './garageStore';
import { useBuildStore } from './stores';

/** Aracın gösterileceği build: kayıtlı son oturum, yoksa stok kurulum. */
export function buildForCar(carId: string): BuildState {
  return (
    useGarageStore.getState().autosaves[carId]?.build ?? createDefaultBuild(getCar(carId).manifest)
  );
}

/**
 * Seçim ekranında aracı vitrinde gösterir (kayıtlı kurulumuyla). Kullanıcı değişikliği
 * sayılmaz: otomatik kaydı tetiklemez. Önceki aracın bekleyen kaydı önce yazılır.
 */
export async function previewCar(carId: string, force = false): Promise<void> {
  // Başlangıçta store varsayılan build'le açılır: force ile kayıtlı kurulum yeniden gösterilir
  if (!force && useBuildStore.getState().build.carId === carId) return;
  await flushAutosave();
  const build = buildForCar(carId);
  markPristine(build);
  useBuildStore.getState().setCar(build);
  useGarageStore.setState({ currentSlotId: null });
}

/** Aracı seçer ve atölyeye geçer (menü kategorisi sıfırlanır). */
export async function enterCar(carId: string): Promise<void> {
  await previewCar(carId);
  const app = useAppStore.getState();
  app.selectCategory(null);
  app.setMode('garage');
  void rememberLastCar(carId);
}

/** Atölyeden araç seçim ekranına döner (çalışma otomatik kaydedilir). */
export async function leaveToSelect(): Promise<void> {
  await flushAutosave();
  const app = useAppStore.getState();
  app.selectCategory(null);
  app.setMode('select');
}
