import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type AppMode = 'garage' | 'drive';

export type AppState = {
  mode: AppMode;
  turntable: boolean;
  setMode: (mode: AppMode) => void;
  toggleTurntable: () => void;
};

export const createAppStore = () =>
  create<AppState>()(
    immer((set) => ({
      mode: 'garage',
      turntable: true,
      setMode: (mode) =>
        set((s) => {
          s.mode = mode;
        }),
      toggleTurntable: () =>
        set((s) => {
          s.turntable = !s.turntable;
        }),
    })),
  );

export const useAppStore = createAppStore();
