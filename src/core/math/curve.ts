export type Curve = (x: number) => number;
export type CurvePoint = readonly [number, number];

/**
 * Noktalardan geçen, aşma (overshoot) yapmayan monoton kübik Hermite eğrisi
 * (Fritsch–Carlson). Aralık dışında uç değerlere sabitlenir.
 */
export function monotoneCurve(input: readonly CurvePoint[]): Curve {
  if (input.length === 0) throw new Error('Eğri için en az bir nokta gerekli');
  const pts = [...input].sort((a, b) => a[0] - b[0]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const n = pts.length;
  if (n === 1) return () => ys[0] as number;

  const at = (arr: number[], i: number) => arr[i] as number;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((at(ys, i + 1) - at(ys, i)) / (at(xs, i + 1) - at(xs, i)));

  const m: number[] = new Array<number>(n);
  m[0] = at(d, 0);
  m[n - 1] = at(d, n - 2);
  for (let i = 1; i < n - 1; i++) {
    const a = at(d, i - 1);
    const b = at(d, i);
    m[i] = a * b <= 0 ? 0 : (a + b) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    const di = at(d, i);
    if (di === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = at(m, i) / di;
    const b = at(m, i + 1) / di;
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * di;
      m[i + 1] = k * b * di;
    }
  }

  return (x: number) => {
    if (x <= at(xs, 0)) return at(ys, 0);
    if (x >= at(xs, n - 1)) return at(ys, n - 1);
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (at(xs, mid) <= x) lo = mid;
      else hi = mid;
    }
    const h = at(xs, hi) - at(xs, lo);
    const t = (x - at(xs, lo)) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * at(ys, lo) +
      (t3 - 2 * t2 + t) * h * at(m, lo) +
      (-2 * t3 + 3 * t2) * at(ys, hi) +
      (t3 - t2) * h * at(m, hi)
    );
  };
}
