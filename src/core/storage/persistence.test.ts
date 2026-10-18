import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultBuild } from '../build/build';
import { useGarageStore } from '../store/garageStore';
import { LEGACY_STORAGE_KEY, usePaintPresetStore } from '../store/paintPresetStore';
import { useBuildStore } from '../store/stores';
import { DEFAULT_PAINT } from '../paint/paint';
import { exportBuildJson } from './garageService';
import { createIdbStorage, createMemoryStorage } from './garageStorage';
import {
  flushAutosave,
  initPersistence,
  PRESETS_META_KEY,
  resetPersistenceForTests,
} from './persistence';

const manifest = useBuildStore.getState().manifest;
const build = () => useBuildStore.getState().build;
const garage = () => useGarageStore.getState();

/** Node'da localStorage yok: eski veri taşıma testi için basit bir taklit. */
function memoryLocalStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryLocalStorage());
  resetPersistenceForTests();
  useBuildStore.getState().loadBuild(createDefaultBuild(manifest));
  usePaintPresetStore.getState().replace([]);
  useGarageStore.setState({ slots: [], currentSlotId: null, notice: null, ready: false });
});

describe('garaj deposu (store)', () => {
  it("kaydet → liste → yükle: çalışma build'i slota yazılır, yüklenince geri gelir", async () => {
    await garage().init(createMemoryStorage());
    useBuildStore.getState().setPart('hood', 'cowl_induction');
    useBuildStore.getState().setName('Birinci');
    await garage().save({ thumbnail: 'data:image/jpeg;base64,x' });
    expect(garage().slots).toHaveLength(1);
    expect(garage().currentSlotId).toBe(garage().slots[0]?.id);
    expect(garage().notice).toMatchObject({ kind: 'ok', key: 'garage.saved' });

    useBuildStore.getState().setPart('hood', 'stock');
    await garage().save();
    expect(garage().slots).toHaveLength(1); // aynı slot üzerine yazıldı

    const id = garage().slots[0]?.id ?? '';
    useBuildStore.getState().setPart('hood', 'shaker_scoop');
    await garage().load(id);
    expect(build().parts.hood).toBe('stock');
    expect(garage().slots[0]?.thumbnail).toBe('data:image/jpeg;base64,x');
  });

  it('"yeni olarak kaydet" ikinci slot açar; silme listeden kaldırır', async () => {
    await garage().init(createMemoryStorage());
    await garage().save();
    await garage().save({ asNew: true });
    expect(garage().slots).toHaveLength(2);
    await garage().remove(garage().slots[0]?.id ?? '');
    expect(garage().slots).toHaveLength(1);
  });

  it("JSON içe aktarma çalışma build'ini değiştirir, hatalı JSON bildirim verir", async () => {
    await garage().init(createMemoryStorage());
    const source = { ...createDefaultBuild(manifest), name: 'Dışarıdan' };
    source.parts = { ...source.parts, spoiler_rear: 'high_wing' };
    garage().importText(exportBuildJson(source));
    expect(build().parts.spoiler_rear).toBe('high_wing');
    expect(build().name).toBe('Dışarıdan');
    expect(garage().currentSlotId).toBeNull();
    garage().importText('{bozuk');
    expect(garage().notice).toMatchObject({ kind: 'error', key: 'garage.error.invalid_json' });
    expect(build().name).toBe('Dışarıdan');
  });

  it('yeni proje varsayılana döner ve geçmişi temizler', async () => {
    await garage().init(createMemoryStorage());
    useBuildStore.getState().setPart('hood', 'cowl_induction');
    garage().newProject();
    expect(build().parts.hood).toBe('stock');
    expect(useBuildStore.getState().history.past).toHaveLength(0);
  });

  it('proje adı geçmişe yazılmaz ve temizlenir', () => {
    useBuildStore.getState().setName('   ');
    expect(build().name).toBe(createDefaultBuild(manifest).name);
    useBuildStore.getState().setName('  Ad  ');
    expect(build().name).toBe('Ad');
    expect(useBuildStore.getState().history.past).toHaveLength(0);
  });
});

describe('kalıcılık (açılışta geri yükleme)', () => {
  it('otomatik kayıt: değişiklik yazılır, "sayfa yenilenince" son oturum özetinde geri gelir', async () => {
    const factory = new IDBFactory();
    await initPersistence(createIdbStorage(factory));
    useBuildStore.getState().setPart('grille', 'billet');
    await flushAutosave();
    expect(garage().autosaves[manifest.id]?.build.parts.grille).toBe('billet');

    // Sayfa yenileme: stor sıfırlanır, aynı veritabanı yeniden açılır
    resetPersistenceForTests();
    useGarageStore.setState({ autosaves: {} });
    useBuildStore.getState().loadBuild(createDefaultBuild(manifest));
    expect(build().parts.grille).toBe('stock');
    await initPersistence(createIdbStorage(factory));
    expect(garage().autosaves[manifest.id]?.build.parts.grille).toBe('billet');
  });

  it("boya presetleri IndexedDB'ye yazılır ve açılışta yüklenir", async () => {
    const factory = new IDBFactory();
    await initPersistence(createIdbStorage(factory));
    usePaintPresetStore.getState().add('Benimki', DEFAULT_PAINT);
    // Yazma arka planda yapılır: depoda görünene kadar bekle (en çok 1 sn)
    const probe = createIdbStorage(factory);
    for (let i = 0; i < 50; i++) {
      const stored = (await probe.getMeta<unknown[]>(PRESETS_META_KEY)) ?? [];
      if (stored.length === 1) break;
      await new Promise((r) => setTimeout(r, 20));
    }

    resetPersistenceForTests();
    usePaintPresetStore.getState().replace([]);
    const reopened = createIdbStorage(factory);
    expect(await reopened.getMeta(PRESETS_META_KEY)).toHaveLength(1);
    await initPersistence(reopened);
    expect(usePaintPresetStore.getState().presets.map((p) => p.name)).toEqual(['Benimki']);
  });

  it('eski localStorage presetleri taşınır ve silinir', async () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        state: { presets: [{ id: 'eski1', name: 'Eski Renk', paint: DEFAULT_PAINT }] },
        version: 0,
      }),
    );
    const storage = createMemoryStorage();
    await initPersistence(storage);
    expect(usePaintPresetStore.getState().presets.map((p) => p.name)).toEqual(['Eski Renk']);
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(await storage.getMeta(PRESETS_META_KEY)).toHaveLength(1);
  });

  it('ikinci başlatma çağrısı hiçbir şey yapmaz', async () => {
    await initPersistence(createMemoryStorage());
    useBuildStore.getState().setPart('hood', 'cowl_induction');
    await initPersistence(createMemoryStorage()); // started: yok sayılır
    expect(build().parts.hood).toBe('cowl_induction');
  });
});
