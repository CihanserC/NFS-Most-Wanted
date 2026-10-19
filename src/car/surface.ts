/**
 * Gerçek modelden ölçülmüş gövde yüzeyi (`surface.json`). Prosedürel profil (placeholder.json)
 * gerçek gövdeyi yalnız kabaca izler; kaput pimi, spoyler, lip gibi parçalar gerçek yüzeye
 * oturmazsa havada kalır ya da gövdeye gömülür. Harita `surfaceMap.ts` ile ışın izlenerek üretilir.
 *
 * Tüm ölçüler araç uzayında (m): +Z ön, +X sol, y zemin = 0. Değer yoksa (ışın gövdeye çarpmadı) null.
 */
export type Grid1 = { start: number; step: number; values: (number | null)[] };
export type Grid2 = {
  /** Satır ekseni (z) */
  z0: number;
  dz: number;
  /** Sütun ekseni (x ya da y) */
  c0: number;
  dc: number;
  /** values[satır][sütun] */
  values: (number | null)[][];
};

export type CarSurface = {
  /** Üst yüzey yüksekliği: satır z, sütun x (x >= 0; araç simetrik kabul edilir) */
  top: Grid2;
  /** Yan yüzey dış x'i: satır z, sütun y */
  side: Grid2;
  /** x=0'da alt yüzey yüksekliği, z'ye göre */
  bottom: Grid1;
  /** x=0'da en öndeki gövde noktasının z'si, y'ye göre */
  nose: Grid1;
  /** x=0'da en arkadaki gövde noktasının z'si, y'ye göre */
  tail: Grid1;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 1B ızgarada doğrusal ara değer; komşulardan biri yoksa var olan alınır. */
export function sample1(g: Grid1, at: number): number | null {
  const f = (at - g.start) / g.step;
  const i = Math.floor(f);
  const a = g.values[Math.max(0, Math.min(g.values.length - 1, i))] ?? null;
  const b = g.values[Math.max(0, Math.min(g.values.length - 1, i + 1))] ?? null;
  if (a === null) return b;
  if (b === null) return a;
  return lerp(a, b, Math.min(1, Math.max(0, f - i)));
}

/** 2B ızgarada çift doğrusal ara değer; eksik köşeler var olanların ortalamasıyla doldurulur. */
export function sample2(g: Grid2, z: number, c: number): number | null {
  const fz = (z - g.z0) / g.dz;
  const fc = (c - g.c0) / g.dc;
  const rows = g.values.length;
  const cols = g.values[0]?.length ?? 0;
  const iz = Math.max(0, Math.min(rows - 2, Math.floor(fz)));
  const ic = Math.max(0, Math.min(cols - 2, Math.floor(fc)));
  const tz = Math.min(1, Math.max(0, fz - iz));
  const tc = Math.min(1, Math.max(0, fc - ic));
  const at = (r: number, c2: number) => g.values[r]?.[c2] ?? null;
  const corners = [at(iz, ic), at(iz, ic + 1), at(iz + 1, ic), at(iz + 1, ic + 1)];
  const known = corners.filter((v): v is number => v !== null);
  if (known.length === 0) return null;
  const mean = known.reduce((s, v) => s + v, 0) / known.length;
  const [a, b, c3, d] = corners.map((v) => v ?? mean) as [number, number, number, number];
  return lerp(lerp(a, b, tc), lerp(c3, d, tc), tz);
}

const isGrid1 = (v: unknown): v is Grid1 =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as Grid1).start === 'number' &&
  typeof (v as Grid1).step === 'number' &&
  Array.isArray((v as Grid1).values);

const isGrid2 = (v: unknown): v is Grid2 =>
  typeof v === 'object' &&
  v !== null &&
  ['z0', 'dz', 'c0', 'dc'].every((k) => typeof (v as Record<string, unknown>)[k] === 'number') &&
  Array.isArray((v as Grid2).values);

export function parseSurface(json: unknown, source = 'surface.json'): CarSurface {
  const o = json as Record<string, unknown>;
  if (typeof json !== 'object' || json === null) throw new Error(`${source}: nesne bekleniyordu`);
  if (!isGrid2(o.top) || !isGrid2(o.side)) throw new Error(`${source}: top/side ızgarası eksik`);
  if (!isGrid1(o.bottom) || !isGrid1(o.nose) || !isGrid1(o.tail))
    throw new Error(`${source}: bottom/nose/tail eksik`);
  return { top: o.top, side: o.side, bottom: o.bottom, nose: o.nose, tail: o.tail };
}
