import { create } from 'zustand';
import { createDefaultBuild } from '../build/build';
import {
  deleteBuildSlot,
  GarageError,
  importBuildJson,
  listBuilds,
  loadBuildSlot,
  saveBuild,
} from '../storage/garageService';
import {
  createMemoryStorage,
  openGarageStorage,
  type GarageSlot,
  type GarageStorage,
} from '../storage/garageStorage';
import { useBuildStore } from './stores';

/** Kullanıcıya gösterilecek sonuç mesajı (çeviri anahtarı + varsa değerler). */
export type GarageNotice = {
  kind: 'ok' | 'error';
  key: string;
  params?: Record<string, string>;
};

export type GarageState = {
  storage: GarageStorage;
  /** Depo açıldı ve slot listesi okundu mu */
  ready: boolean;
  slots: GarageSlot[];
  /** Çalışma build'inin yazıldığı slot (kaydet = üzerine yaz); yeni/yüklenmemişse null */
  currentSlotId: string | null;
  notice: GarageNotice | null;
  /** Depoyu açar (bir kez) ve listeyi doldurur. Test için depo verilebilir. */
  init: (storage?: GarageStorage) => Promise<GarageStorage>;
  refresh: () => Promise<void>;
  /** Çalışma build'ini kaydeder; asNew ya da henüz slotu yoksa yeni slot açar. */
  save: (options?: { asNew?: boolean; thumbnail?: string | null }) => Promise<void>;
  load: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** JSON metninden build alır; kaydetmez, çalışma build'i olarak yükler. */
  importText: (text: string) => void;
  /** Sıfırdan yeni proje */
  newProject: () => void;
  dismissNotice: () => void;
};

const noticeFor = (error: unknown): GarageNotice => {
  if (error instanceof GarageError) return { kind: 'error', key: `garage.error.${error.code}` };
  return { kind: 'error', key: 'garage.error.storage' };
};

export const useGarageStore = create<GarageState>()((set, get) => {
  let opening: Promise<GarageStorage> | null = null;
  const manifest = () => useBuildStore.getState().manifest;

  return {
    storage: createMemoryStorage(),
    ready: false,
    slots: [],
    currentSlotId: null,
    notice: null,

    init: (provided) => {
      // Test için verilen depo her zaman yeniden açılır; normalde tek açılış paylaşılır.
      if (!provided && opening) return opening;
      const promise = (async () => {
        const storage = provided ?? (await openGarageStorage());
        set({ storage });
        set({ slots: await listBuilds(storage), ready: true });
        return storage;
      })();
      if (!provided) opening = promise;
      return promise;
    },

    refresh: async () => {
      set({ slots: await listBuilds(get().storage) });
    },

    save: async (options = {}) => {
      const { storage, currentSlotId } = get();
      const build = useBuildStore.getState().build;
      try {
        const slot = await saveBuild(storage, build, {
          id: options.asNew ? undefined : (currentSlotId ?? undefined),
          thumbnail: options.thumbnail,
        });
        set({
          currentSlotId: slot.id,
          slots: await listBuilds(storage),
          notice: { kind: 'ok', key: 'garage.saved', params: { name: slot.name } },
        });
      } catch (error) {
        set({ notice: noticeFor(error) });
      }
    },

    load: async (id) => {
      try {
        const build = await loadBuildSlot(get().storage, id, manifest());
        useBuildStore.getState().loadBuild(build);
        set({
          currentSlotId: id,
          notice: { kind: 'ok', key: 'garage.loaded', params: { name: build.name } },
        });
      } catch (error) {
        set({ notice: noticeFor(error) });
      }
    },

    remove: async (id) => {
      try {
        await deleteBuildSlot(get().storage, id);
        set((s) => ({
          currentSlotId: s.currentSlotId === id ? null : s.currentSlotId,
          slots: s.slots.filter((slot) => slot.id !== id),
          notice: { kind: 'ok', key: 'garage.deleted' },
        }));
      } catch (error) {
        set({ notice: noticeFor(error) });
      }
    },

    importText: (text) => {
      try {
        const build = importBuildJson(text, manifest());
        useBuildStore.getState().loadBuild(build);
        set({
          currentSlotId: null,
          notice: { kind: 'ok', key: 'garage.imported', params: { name: build.name } },
        });
      } catch (error) {
        set({ notice: noticeFor(error) });
      }
    },

    newProject: () => {
      useBuildStore.getState().loadBuild(createDefaultBuild(manifest()));
      set({ currentSlotId: null, notice: { kind: 'ok', key: 'garage.newProject.notice' } });
    },

    dismissNotice: () => set({ notice: null }),
  };
});
