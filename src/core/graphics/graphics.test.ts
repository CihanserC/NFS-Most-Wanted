import { describe, expect, it } from 'vitest';
import { qualityPresets, sanitizeGraphics, useGraphicsStore } from '../store/graphicsStore';
import {
  initialAutoQuality,
  LOW_FPS,
  lowerQuality,
  SLOW_SAMPLES,
  stepAutoQuality,
  WARMUP_SECONDS,
  type AutoQualityState,
} from './autoQuality';

const run = (
  state: AutoQualityState,
  fps: number,
  times: number,
  quality: 'ultra' | 'high' | 'medium' | 'low' = 'high',
  dt = 0.5,
) => {
  let s = state;
  let lowerTo: string | null = null;
  for (let i = 0; i < times; i++) {
    const r = stepAutoQuality(s, { fps, dt, quality, active: true });
    s = r.state;
    lowerTo = r.lowerTo ?? lowerTo;
  }
  return { state: s, lowerTo };
};

describe('uyarlanabilir kalite', () => {
  it('ısınma süresince ölçümler yok sayılır', () => {
    const { lowerTo } = run(initialAutoQuality(), 10, Math.floor(WARMUP_SECONDS / 0.5) - 1);
    expect(lowerTo).toBeNull();
  });

  it('ısınmadan sonra art arda yavaş ölçümler kaliteyi bir kademe düşürür', () => {
    const warm = run(initialAutoQuality(), 60, Math.ceil(WARMUP_SECONDS / 0.5)).state;
    expect(warm.warmup).toBe(0);
    expect(run(warm, LOW_FPS - 1, SLOW_SAMPLES - 1).lowerTo).toBeNull();
    const result = run(warm, LOW_FPS - 1, SLOW_SAMPLES);
    expect(result.lowerTo).toBe('medium');
    // Düşüşten sonra yeniden ısınma: hemen ikinci düşüş olmaz
    expect(run(result.state, 10, 3, 'medium').lowerTo).toBeNull();
  });

  it('tek bir hızlı ölçüm yavaş serisini sıfırlar', () => {
    const warm = { slow: 0, warmup: 0 };
    let s = run(warm, 20, SLOW_SAMPLES - 1).state;
    s = run(s, 60, 1).state;
    expect(run(s, 20, SLOW_SAMPLES - 1).lowerTo).toBeNull();
  });

  it('en düşük kalitede ya da etkin değilken düşürmez', () => {
    const warm = { slow: 0, warmup: 0 };
    expect(run(warm, 5, 20, 'low').lowerTo).toBeNull();
    const inactive = stepAutoQuality(
      { slow: SLOW_SAMPLES, warmup: 0 },
      { fps: 5, dt: 0.5, quality: 'high', active: false },
    );
    expect(inactive.lowerTo).toBeNull();
    expect(inactive.state.slow).toBe(0);
  });

  it('kademe sırası ultra > high > medium > low', () => {
    expect(lowerQuality('ultra')).toBe('high');
    expect(lowerQuality('high')).toBe('medium');
    expect(lowerQuality('medium')).toBe('low');
    expect(lowerQuality('low')).toBe('low');
  });
});

describe('grafik ayarları', () => {
  it('kayıtlı veriden otomatik kalite varsayılanı açık, bozuk değer geçerliye döner', () => {
    expect(sanitizeGraphics({}).autoQuality).toBe(true);
    expect(sanitizeGraphics({ autoQuality: false }).autoQuality).toBe(false);
    expect(sanitizeGraphics({ autoQuality: 'evet' }).autoQuality).toBe(true);
  });

  it('elle kalite seçimi otomatik kaliteyi kapatır; otomatik düşüş kapatmaz ve bildirim üretir', () => {
    const s = useGraphicsStore.getState();
    s.setAutoQuality(true);
    s.lowerQualityAuto('medium');
    expect(useGraphicsStore.getState()).toMatchObject({
      quality: 'medium',
      autoQuality: true,
      autoNotice: { level: 'medium', id: 1 },
    });
    useGraphicsStore.getState().lowerQualityAuto('low');
    expect(useGraphicsStore.getState().autoNotice?.id).toBe(2);
    useGraphicsStore.getState().setQuality('high');
    expect(useGraphicsStore.getState()).toMatchObject({ autoQuality: false, autoNotice: null });
  });

  it('kalite kademeleri maliyet sırasında azalır (gölge/AO/bloom açıklığı)', () => {
    expect(qualityPresets.low.shadows).toBe(false);
    expect(qualityPresets.ultra.ao).not.toBeNull();
  });
});
