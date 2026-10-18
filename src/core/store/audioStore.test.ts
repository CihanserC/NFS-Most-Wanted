import { describe, expect, it } from 'vitest';
import { nextVolume, sanitizeVolume, useAudioStore, VOLUME_STEPS } from './audioStore';

describe('ses ayarı', () => {
  it('basamaklar sırayla döner: tam → yarım → kapalı → tam', () => {
    expect(VOLUME_STEPS).toEqual([1, 0.5, 0]);
    expect(nextVolume(1)).toBe(0.5);
    expect(nextVolume(0.5)).toBe(0);
    expect(nextVolume(0)).toBe(1);
  });

  it('basamak dışı değer en yakın basamaktan devam eder', () => {
    expect(nextVolume(0.7)).toBe(0); // 0.7 en yakın: 0.5 → sonraki 0
    expect(nextVolume(0.2)).toBe(1); // en yakın 0 → sonraki 1
  });

  it('bozuk değer 0..1 aralığına çevrilir', () => {
    expect(sanitizeVolume('x')).toBe(1);
    expect(sanitizeVolume(NaN)).toBe(1);
    expect(sanitizeVolume(5)).toBe(1);
    expect(sanitizeVolume(-2)).toBe(0);
    expect(sanitizeVolume(0.3)).toBe(0.3);
  });

  it('store: döngü ve doğrudan atama', () => {
    useAudioStore.getState().setVolume(1);
    useAudioStore.getState().cycleVolume();
    expect(useAudioStore.getState().volume).toBe(0.5);
    useAudioStore.getState().setVolume(9);
    expect(useAudioStore.getState().volume).toBe(1);
  });
});
