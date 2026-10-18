import { QUALITY_LEVELS, type QualityLevel } from '../store/graphicsStore';

/** Bu FPS'in altı "yavaş" sayılır (hedef 60; titreşimle sürekli düşmesin diye pay bırakılır). */
export const LOW_FPS = 42;
/** Art arda bu kadar yavaş ölçümden sonra kalite bir kademe düşer (ölçüm aralığı ≈ 0,5 sn). */
export const SLOW_SAMPLES = 4;
/** Başlangıçta ve her kalite değişiminden sonra yok sayılan süre (sn): shader derlemesi / ısınma */
export const WARMUP_SECONDS = 6;

export type AutoQualityState = {
  /** Art arda yavaş ölçüm sayısı */
  slow: number;
  /** Ölçümlerin yok sayılacağı kalan süre (sn) */
  warmup: number;
};

export const initialAutoQuality = (): AutoQualityState => ({ slow: 0, warmup: WARMUP_SECONDS });

/** Bir kademe düşük kalite (en düşük: low); zaten en düşükse aynısı. */
export function lowerQuality(level: QualityLevel): QualityLevel {
  const i = QUALITY_LEVELS.indexOf(level);
  return QUALITY_LEVELS[Math.max(0, i - 1)] as QualityLevel;
}

/**
 * Uyarlanabilir kalite adımı. Yalnızca kaliteyi düşürür (yukarı çıkmaz: salınımı önler).
 * fps ölçümü dt saniyede bir gelir; sekme gizliyken ya da duraklatılmışken `active` false verilir.
 */
export function stepAutoQuality(
  state: AutoQualityState,
  input: { fps: number; dt: number; quality: QualityLevel; active: boolean },
): { state: AutoQualityState; lowerTo: QualityLevel | null } {
  if (!input.active || input.fps <= 0) return { state: { ...state, slow: 0 }, lowerTo: null };
  if (state.warmup > 0)
    return { state: { slow: 0, warmup: Math.max(0, state.warmup - input.dt) }, lowerTo: null };
  const slow = input.fps < LOW_FPS ? state.slow + 1 : 0;
  if (slow >= SLOW_SAMPLES && input.quality !== 'low')
    return {
      state: { slow: 0, warmup: WARMUP_SECONDS },
      lowerTo: lowerQuality(input.quality),
    };
  return { state: { slow, warmup: 0 }, lowerTo: null };
}
