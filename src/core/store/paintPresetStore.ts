import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sanitizePaint } from '../paint/paint';
import type { PaintConfig } from '../paint/types';

export type UserPaintPreset = { id: string; name: string; paint: PaintConfig };

export type PaintPresetState = {
  presets: UserPaintPreset[];
  add: (name: string, paint: PaintConfig) => void;
  remove: (id: string) => void;
};

export const USER_PRESET_LIMIT = 50;
const STORAGE_KEY = 'muscle-garage.paint-presets';

/** Kayıtlı veriyi her durumda geçerli preset listesine çevirir. */
export function sanitizeUserPresets(input: unknown): UserPaintPreset[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (p): p is { id: string; name: string; paint: unknown } =>
        typeof p === 'object' &&
        p !== null &&
        typeof p.id === 'string' &&
        typeof p.name === 'string',
    )
    .slice(0, USER_PRESET_LIMIT)
    .map((p) => ({ id: p.id, name: p.name.slice(0, 40), paint: sanitizePaint(p.paint) }));
}

/**
 * Kullanıcının kaydettiği boya presetleri. Faz 9'da IndexedDB garajına taşınana kadar
 * tarayıcı localStorage'ında tutulur (erişilemezse sadece bu oturumda yaşar).
 */
export const usePaintPresetStore = create<PaintPresetState>()(
  persist(
    (set) => ({
      presets: [],
      add: (name, paint) =>
        set((s) => ({
          presets: [
            {
              id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
              name,
              paint,
            },
            ...s.presets,
          ].slice(0, USER_PRESET_LIMIT),
        })),
      remove: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ presets: s.presets }),
      merge: (persisted, current) => ({
        ...current,
        presets: sanitizeUserPresets((persisted as { presets?: unknown } | undefined)?.presets),
      }),
    },
  ),
);
