import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type AppMode = 'garage' | 'drive';

export type AppState = {
  mode: AppMode;
  turntable: boolean;
  /** Atölye menüsünde seçili kategori ve slot (kamera odağını da belirler). */
  categoryId: string | null;
  slotId: string | null;
  /** Geri dönülünce menü vurgusunun kalacağı son kategori/slot. */
  lastCategoryId: string | null;
  lastSlotId: string | null;
  setMode: (mode: AppMode) => void;
  toggleTurntable: () => void;
  selectCategory: (categoryId: string | null) => void;
  selectSlot: (slotId: string | null) => void;
};

export const createAppStore = () =>
  create<AppState>()(
    immer((set) => ({
      mode: 'garage',
      turntable: true,
      categoryId: null,
      slotId: null,
      lastCategoryId: null,
      lastSlotId: null,
      setMode: (mode) =>
        set((s) => {
          s.mode = mode;
        }),
      toggleTurntable: () =>
        set((s) => {
          s.turntable = !s.turntable;
        }),
      selectCategory: (categoryId) =>
        set((s) => {
          if (s.categoryId !== null) s.lastCategoryId = s.categoryId;
          s.categoryId = categoryId;
          s.slotId = null;
          s.lastSlotId = null;
        }),
      selectSlot: (slotId) =>
        set((s) => {
          if (s.slotId !== null) s.lastSlotId = s.slotId;
          s.slotId = slotId;
        }),
    })),
  );

export const useAppStore = createAppStore();
