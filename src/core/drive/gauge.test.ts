import { describe, expect, it } from 'vitest';
import { arcPath, gaugeAngle, gaugeScale, gearLabel, GAUGE_START_DEG, polar } from './gauge';

describe('devir saati kadranı', () => {
  it('ölçek kırmızı çizginin üstünde pay bırakır ve binliklere yuvarlanır', () => {
    expect(gaugeScale(6000).max).toBe(7000);
    expect(gaugeScale(6400).max).toBe(7000);
    expect(gaugeScale(6600).max).toBe(8000);
    const s = gaugeScale(6000);
    expect(s.majors).toEqual([0, 1000, 2000, 3000, 4000, 5000, 6000, 7000]);
    expect(s.minors).toHaveLength(7);
  });

  it('açı 0 rpm başlangıçta, azamide 270° sonra; aralık dışı kırpılır', () => {
    expect(gaugeAngle(0, 7000)).toBe(GAUGE_START_DEG);
    expect(gaugeAngle(7000, 7000)).toBe(GAUGE_START_DEG + 270);
    expect(gaugeAngle(3500, 7000)).toBe(GAUGE_START_DEG + 135);
    expect(gaugeAngle(-100, 7000)).toBe(GAUGE_START_DEG);
    expect(gaugeAngle(9000, 7000)).toBe(GAUGE_START_DEG + 270);
  });

  it('kutupsal nokta ve yay yolu', () => {
    const [x, y] = polar(100, 100, 50, 90);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(150);
    expect(arcPath(0, 0, 10, 135, 405)).toContain(' 0 1 1 ');
    expect(arcPath(0, 0, 10, 135, 200)).toContain(' 0 0 1 ');
  });

  it('vites etiketi: geri R, dururken N', () => {
    expect(gearLabel(0, true, 5)).toBe('R');
    expect(gearLabel(1, false, 0)).toBe('N');
    expect(gearLabel(1, false, 10)).toBe('1');
    expect(gearLabel(4, false, 120)).toBe('4');
  });
});
