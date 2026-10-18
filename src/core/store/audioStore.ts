import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Ses seviyesi basamakları (döngüyle seçilir): tam, yarım, kapalı */
export const VOLUME_STEPS = [1, 0.5, 0] as const;

export type AudioState = {
  /** 0..1 ana ses seviyesi (motor, lastik ve menü sesleri) */
  volume: number;
  /** Basamaklar arasında sırayla geçer (tam → yarım → kapalı → tam) */
  cycleVolume: () => void;
  setVolume: (volume: number) => void;
};

/** Kayıtlı değeri her durumda 0..1 aralığına çevirir. */
export const sanitizeVolume = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;

/** Bir sonraki ses basamağı: mevcut değere en yakın basamaktan sonrakine. */
export function nextVolume(volume: number): number {
  let nearest = 0;
  VOLUME_STEPS.forEach((step, i) => {
    if (Math.abs(step - volume) < Math.abs((VOLUME_STEPS[nearest] as number) - volume)) nearest = i;
  });
  return VOLUME_STEPS[(nearest + 1) % VOLUME_STEPS.length] as number;
}

/** Ses ayarı tarayıcıda saklanır (erişilemezse sadece bu oturumda yaşar). */
export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => ({
      volume: 1,
      cycleVolume: () => set({ volume: nextVolume(get().volume) }),
      setVolume: (volume) => set({ volume: sanitizeVolume(volume) }),
    }),
    {
      name: 'muscle-garage.audio',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ volume: s.volume }),
      merge: (persisted, current) => ({
        ...current,
        volume: sanitizeVolume((persisted as { volume?: unknown } | undefined)?.volume),
      }),
    },
  ),
);
