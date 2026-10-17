import { describe, expect, it } from 'vitest';
import { monotoneCurve } from './curve';
import { memoize } from '../cache/memoize';

describe('monotoneCurve', () => {
  const pts = [
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 3],
  ] as const;
  const f = monotoneCurve(pts);

  it('kontrol noktalarından geçer', () => {
    for (const [x, y] of pts) expect(f(x)).toBeCloseTo(y);
  });

  it('düz bölümde aşma yapmaz', () => {
    for (let x = 1; x <= 2; x += 0.05) expect(f(x)).toBeCloseTo(1, 6);
  });

  it('aralık dışında uç değerlere sabitlenir', () => {
    expect(f(-5)).toBe(0);
    expect(f(10)).toBe(3);
  });

  it('sırasız noktaları kabul eder', () => {
    const g = monotoneCurve([
      [2, 4],
      [0, 0],
    ]);
    expect(g(1)).toBeCloseTo(2);
  });
});

describe('memoize', () => {
  it('aynı anahtar için aynı nesneyi döndürür', () => {
    let calls = 0;
    const make = memoize(
      (n: number) => String(n),
      (n: number) => {
        calls++;
        return { n };
      },
    );
    expect(make(1)).toBe(make(1));
    expect(make(2)).not.toBe(make(1));
    expect(calls).toBe(2);
  });
});
