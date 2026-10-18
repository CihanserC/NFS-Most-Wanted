import { create } from 'zustand';

export const PHOTO_LIMITS = {
  fov: { min: 18, max: 90, step: 1 },
  bokeh: { min: 0, max: 10, step: 0.5 },
  /** Odak aralığı (m): küçük = ince alan derinliği */
  focusRange: { min: 0.3, max: 8, step: 0.1 },
  /** Pozlama telafisi (EV, stop) */
  exposure: { min: -2, max: 2, step: 0.1 },
} as const;

/** Çıktı piksel oranı seçenekleri (CSS pikseline göre) */
export const PHOTO_SCALES = [1, 2, 3, 4] as const;
export type PhotoScale = (typeof PHOTO_SCALES)[number];

export const PHOTO_DEFAULTS = {
  fov: 40,
  dofEnabled: false,
  bokeh: 4,
  focusRange: 2,
  exposure: 0,
  scale: 2 as PhotoScale,
};

export type PhotoState = typeof PHOTO_DEFAULTS & {
  /** Menüyü gizle (temiz kadraj) */
  hideUi: boolean;
  /** Fotoğraf çekiliyor (düğme kilidi) */
  busy: boolean;
  /** Son hata/bilgi (çeviri anahtarı) */
  noticeKey: string | null;
  set: (patch: Partial<typeof PHOTO_DEFAULTS>) => void;
  setHideUi: (hide: boolean) => void;
  setBusy: (busy: boolean) => void;
  setNotice: (key: string | null) => void;
  reset: () => void;
};

const clamp = (v: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, v));

export const usePhotoStore = create<PhotoState>()((set) => ({
  ...PHOTO_DEFAULTS,
  hideUi: false,
  busy: false,
  noticeKey: null,
  set: (patch) =>
    set((s) => ({
      ...patch,
      ...(patch.fov !== undefined ? { fov: clamp(patch.fov, PHOTO_LIMITS.fov) } : {}),
      ...(patch.bokeh !== undefined ? { bokeh: clamp(patch.bokeh, PHOTO_LIMITS.bokeh) } : {}),
      ...(patch.focusRange !== undefined
        ? { focusRange: clamp(patch.focusRange, PHOTO_LIMITS.focusRange) }
        : {}),
      ...(patch.exposure !== undefined
        ? { exposure: clamp(patch.exposure, PHOTO_LIMITS.exposure) }
        : {}),
      ...(patch.scale !== undefined && !PHOTO_SCALES.includes(patch.scale)
        ? { scale: s.scale }
        : {}),
    })),
  setHideUi: (hideUi) => set({ hideUi }),
  setBusy: (busy) => set({ busy }),
  setNotice: (noticeKey) => set({ noticeKey }),
  reset: () => set({ ...PHOTO_DEFAULTS, hideUi: false, busy: false, noticeKey: null }),
}));
