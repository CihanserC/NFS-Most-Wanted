import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import qualityJson from '../../data/graphics/quality.json';

export const QUALITY_LEVELS = ['low', 'medium', 'high', 'ultra'] as const;
export type QualityLevel = (typeof QUALITY_LEVELS)[number];

export const TONE_MAPPINGS = ['agx', 'aces'] as const;
export type ToneMappingChoice = (typeof TONE_MAPPINGS)[number];

export type QualityPreset = {
  /** Cihaz piksel oranı üst sınırı */
  dpr: number;
  shadows: boolean;
  shadowMapSize: number;
  floorReflection: boolean;
  reflectorResolution: number;
  ao: { quality: 'performance' | 'low' | 'medium' | 'high' | 'ultra'; halfRes: boolean } | null;
  bloom: boolean;
  antialias: 'fxaa' | 'smaa';
  /** MSAA örnek sayısı (composer çoklu örnekleme), 0 = kapalı */
  msaaSamples: number;
  volumetric: boolean;
  /** Boya pulları (shader maliyeti) */
  flakes: boolean;
};

export const qualityPresets = qualityJson as Record<QualityLevel, QualityPreset>;

export const DEFAULT_QUALITY: QualityLevel = 'high';
/**
 * §17 kararı (2026-10-17, karşılaştırma: docs/tonemapping/): varsayılan ACES (daha doygun,
 * dramatik Most Wanted havası); oyuncu üst çubuktan AgX'e geçebilir.
 */
export const DEFAULT_TONE_MAPPING: ToneMappingChoice = 'aces';

export type GraphicsState = {
  quality: QualityLevel;
  toneMapping: ToneMappingChoice;
  showFps: boolean;
  /** Yavaş çalışırken kaliteyi otomatik düşür */
  autoQuality: boolean;
  /** Otomatik düşürmenin bildirimi (UI gösterir; yeni düşüşte yenilenir) */
  autoNotice: { level: QualityLevel; id: number } | null;
  /** Ölçülen kare hızı ve son karenin çizim istatistikleri (kalıcı değil) */
  fps: number;
  drawCalls: number;
  triangles: number;
  /** Kullanıcı seçimi: otomatik kaliteyi kapatır (seçimi geri düşürmesin) */
  setQuality: (q: QualityLevel) => void;
  /** Otomatik düşürme: kullanıcı seçimi sayılmaz, otomatik kaliteyi kapatmaz */
  lowerQualityAuto: (q: QualityLevel) => void;
  setAutoQuality: (on: boolean) => void;
  setToneMapping: (t: ToneMappingChoice) => void;
  setShowFps: (v: boolean) => void;
  setStats: (s: { fps: number; drawCalls: number; triangles: number }) => void;
};

const oneOf = <T>(list: readonly T[], v: unknown, fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

/** Kayıtlı ayarları her durumda geçerli değerlere çevirir. */
export function sanitizeGraphics(
  input: unknown,
): Pick<GraphicsState, 'quality' | 'toneMapping' | 'showFps' | 'autoQuality'> {
  const src = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  return {
    quality: oneOf(QUALITY_LEVELS, src.quality, DEFAULT_QUALITY),
    toneMapping: oneOf(TONE_MAPPINGS, src.toneMapping, DEFAULT_TONE_MAPPING),
    showFps: typeof src.showFps === 'boolean' ? src.showFps : true,
    autoQuality: typeof src.autoQuality === 'boolean' ? src.autoQuality : true,
  };
}

/** Grafik ayarları tarayıcıda saklanır (erişilemezse sadece bu oturumda yaşar). */
export const useGraphicsStore = create<GraphicsState>()(
  persist(
    (set) => ({
      ...sanitizeGraphics({}),
      autoNotice: null,
      fps: 0,
      drawCalls: 0,
      triangles: 0,
      setQuality: (quality) => set({ quality, autoQuality: false, autoNotice: null }),
      lowerQualityAuto: (quality) =>
        set((s) => ({ quality, autoNotice: { level: quality, id: (s.autoNotice?.id ?? 0) + 1 } })),
      setAutoQuality: (autoQuality) => set({ autoQuality, autoNotice: null }),
      setToneMapping: (toneMapping) => set({ toneMapping }),
      setShowFps: (showFps) => set({ showFps }),
      setStats: (stats) => set(stats),
    }),
    {
      name: 'muscle-garage.graphics',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        quality: s.quality,
        toneMapping: s.toneMapping,
        showFps: s.showFps,
        autoQuality: s.autoQuality,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitizeGraphics(persisted) }),
    },
  ),
);

export const useQualityPreset = (): QualityPreset =>
  qualityPresets[useGraphicsStore((s) => s.quality)];
