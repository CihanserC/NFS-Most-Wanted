import { describe, expect, it } from 'vitest';
import {
  combinedScale,
  lateralCoefficient,
  lateralForce,
  PEAK_SLIP_ANGLE,
  slipAngle,
  TIRE,
} from './tire';

describe('lastik yanal modeli', () => {
  it('küçük kayma açısında kademeli (doğrusala yakın), tepede 1 civarı', () => {
    const small = lateralCoefficient(0.02);
    const mid = lateralCoefficient(0.06);
    expect(small).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(small * 2);
    expect(lateralCoefficient(PEAK_SLIP_ANGLE)).toBeCloseTo(1, 3);
    // Doygunluk: 2° direksiyonda tam tutuş kullanılmaz
    expect(lateralCoefficient((2 * Math.PI) / 180)).toBeLessThan(0.6);
  });

  it('tepe kayma açısı makul (≈5-9°) ve tepeden sonra kuvvet düşer', () => {
    const deg = (PEAK_SLIP_ANGLE * 180) / Math.PI;
    expect(deg).toBeGreaterThan(5);
    expect(deg).toBeLessThan(9);
    expect(lateralCoefficient(PEAK_SLIP_ANGLE * 3)).toBeLessThan(1);
    expect(lateralCoefficient(PEAK_SLIP_ANGLE * 3)).toBeGreaterThan(0.6);
  });

  it('kuvvet kaymaya karşı koyar ve yükle orantılı', () => {
    expect(lateralForce(0.1, 4000, 1)).toBeLessThan(0);
    expect(lateralForce(-0.1, 4000, 1)).toBeGreaterThan(0);
    expect(Math.abs(lateralForce(0.1, 8000, 1))).toBeCloseTo(
      2 * Math.abs(lateralForce(0.1, 4000, 1)),
      6,
    );
    expect(lateralForce(0, 4000, 1)).toBe(0);
  });

  it('kayma açısı: düşük hızda tekillik yok, işaret yanal hızı izler', () => {
    expect(slipAngle(1, 0)).toBeCloseTo(Math.atan2(1, TIRE.minSpeed), 6);
    expect(slipAngle(-3, 20)).toBeLessThan(0);
    expect(slipAngle(3, -20)).toBeCloseTo(slipAngle(3, 20), 9);
    expect(slipAngle(0, 30)).toBe(0);
  });

  it('sürtünme çemberi: boyuna kullanım arttıkça yanal tutuş azalır ama sıfırlanmaz', () => {
    expect(combinedScale(0)).toBe(1);
    expect(combinedScale(0.6)).toBeCloseTo(0.8, 5);
    expect(combinedScale(1)).toBeCloseTo(0.12, 5);
    expect(combinedScale(5)).toBeCloseTo(0.12, 5);
    expect(combinedScale(0.3)).toBeGreaterThan(combinedScale(0.7));
  });
});
