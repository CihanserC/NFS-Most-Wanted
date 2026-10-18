import { create } from 'zustand';
import { sanitizePaint } from '../paint/paint';
import type { PaintConfig } from '../paint/types';

export type UserPaintPreset = { id: string; name: string; paint: PaintConfig };

export type PaintPresetState = {
  presets: UserPaintPreset[];
  add: (name: string, paint: PaintConfig) => void;
  remove: (id: string) => void;
  /** Kalıcı depodan yüklenen listeyi koyar (başlangıçta) */
  replace: (presets: UserPaintPreset[]) => void;
};

export const USER_PRESET_LIMIT = 50;
/** Eski sürümlerin localStorage anahtarı (Faz 9'da IndexedDB'ye taşındı). */
export const LEGACY_STORAGE_KEY = 'muscle-garage.paint-presets';

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
 * Kullanıcının kaydettiği boya presetleri. Liste IndexedDB'de tutulur (persistence.ts
 * başlangıçta yükler ve her değişikliği yazar); store kendisi depolamayı bilmez.
 */
export const usePaintPresetStore = create<PaintPresetState>()((set) => ({
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
  replace: (presets) => set({ presets: sanitizeUserPresets(presets) }),
}));
