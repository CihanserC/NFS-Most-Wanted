import { BufferGeometry, Float32BufferAttribute } from 'three';
import { memoize } from '../../core/cache/memoize';
import type { BodySampler } from './profile';

/** Alt gövde materyal grupları (mesh material dizisindeki indeksler). */
export const LOWER_BODY_GROUP = { body: 0, hood: 1, under: 2 } as const;
/** Kabin materyal grupları. */
export const CABIN_GROUP = { body: 0, roof: 1, glass: 2 } as const;

type SegmentKind = 'under' | 'side' | 'deck';
type RingPoint = { x: number; y: number; hard: boolean };
type Ring = { points: RingPoint[]; kinds: SegmentKind[] };
type Rect = { zMin: number; zMax: number; halfWidth: number };

export type LowerBodyOptions = { hoodCutout: boolean };

const superellipse = (v: number, exponent: number) => Math.sign(v) * Math.abs(v) ** (2 / exponent);

/**
 * z istasyonundaki sağ yarı kesit (alt orta -> üst orta). Tekerlek bölgesinde
 * kesitin dış alt köşesi kemer yüksekliğine çıkarak tekerlek boşluğunu oluşturur.
 */
function rightHalf(s: BodySampler, z: number): Ring {
  const p = s.profile;
  const yb = s.bottomY(z);
  const yt = s.deckY(z);
  const ys = yt - p.shoulderDrop;
  const ya = Math.min(Math.max(s.archTopY(z), yb), ys - p.shoulderDrop);
  const wx = Math.min(p.wellInnerX, s.sideX(z, yb) * 0.9);

  const points: RingPoint[] = [
    { x: 0, y: yb, hard: false },
    { x: wx, y: yb, hard: true },
    { x: wx, y: ya, hard: true },
  ];
  const kinds: SegmentKind[] = ['under', 'under', 'under'];

  for (let i = 0; i < p.sideSamples; i++) {
    const y = ya + ((ys - ya) * i) / (p.sideSamples - 1);
    points.push({ x: s.sideX(z, y), y, hard: i === 0 });
    kinds.push(i === p.sideSamples - 1 ? 'deck' : 'side');
  }

  const xs = s.sideX(z, ys);
  for (let j = 1; j <= p.shoulderSamples; j++) {
    const theta = (Math.PI / 2) * (j / p.shoulderSamples);
    points.push({
      x: j === p.shoulderSamples ? 0 : xs * superellipse(Math.cos(theta), p.shoulderExponent),
      y: ys + (yt - ys) * superellipse(Math.sin(theta), p.shoulderExponent),
      hard: false,
    });
    kinds.push('deck');
  }
  kinds.pop(); // son nokta üst orta; ondan çıkan segment sol yarıdadır
  return { points, kinds };
}

/** Sağ yarıyı aynalayarak kapalı halka üretir (önden bakışta saat yönünün tersi). */
function mirrorRing(half: Ring): Ring {
  const k = half.points.length - 1;
  const points = [...half.points];
  const kinds = [...half.kinds];
  for (let i = k - 1; i >= 1; i--) {
    const pt = half.points[i] as RingPoint;
    points.push({ x: -pt.x, y: pt.y, hard: pt.hard });
  }
  for (let j = 0; j < k; j++) kinds.push(half.kinds[k - j - 1] as SegmentKind);
  return { points, kinds };
}

type Builder = {
  positions: number[];
  buckets: number[][];
};

const newBuilder = (groups: number): Builder => ({
  positions: [],
  buckets: Array.from({ length: groups }, () => []),
});

function addVertex(b: Builder, x: number, y: number, z: number): number {
  b.positions.push(x, y, z);
  return b.positions.length / 3 - 1;
}

function finish(b: Builder): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(b.positions, 3));
  const index: number[] = [];
  b.buckets.forEach((bucket, materialIndex) => {
    g.addGroup(index.length, bucket.length, materialIndex);
    for (const i of bucket) index.push(i);
  });
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

const inside = (r: Rect, x: number, z: number) =>
  z > r.zMin && z < r.zMax && Math.abs(x) < r.halfWidth;

export function buildLowerBodyGeometry(s: BodySampler, opts: LowerBodyOptions): BufferGeometry {
  const p = s.profile;
  const n = p.stations;
  const zs = Array.from({ length: n }, (_, k) => -s.halfLength + (2 * s.halfLength * k) / (n - 1));
  const rings = zs.map((z) => mirrorRing(rightHalf(s, z)));
  const first = rings[0] as Ring;
  const ringSize = first.points.length;

  // Sert köşelerde normaller karışmasın diye vertex ikiye bölünür (giriş/çıkış sütunu).
  const inCol: number[] = [];
  const outCol: number[] = [];
  let cols = 0;
  first.points.forEach((pt) => {
    inCol.push(cols);
    if (pt.hard) cols++;
    outCol.push(cols);
    cols++;
  });

  const holes: Rect[] = [
    {
      zMin: p.cabinOpening.zStart,
      zMax: p.cabinOpening.zEnd,
      halfWidth: p.cabinOpening.halfWidth,
    },
  ];
  if (opts.hoodCutout) {
    const c = p.blowerCutout;
    holes.push({
      zMin: c.zCenter - c.halfLength,
      zMax: c.zCenter + c.halfLength,
      halfWidth: c.halfWidth,
    });
  }

  const b = newBuilder(3);
  rings.forEach((ring, k) => {
    const z = zs[k] as number;
    for (const pt of ring.points) {
      addVertex(b, pt.x, pt.y, z);
      if (pt.hard) addVertex(b, pt.x, pt.y, z);
    }
  });

  const vid = (k: number, col: number) => k * cols + col;
  for (let k = 0; k < n - 1; k++) {
    const z0 = zs[k] as number;
    const z1 = zs[k + 1] as number;
    const zc = (z0 + z1) / 2;
    const ring = rings[k] as Ring;
    for (let i = 0; i < ringSize; i++) {
      const next = (i + 1) % ringSize;
      const kind = ring.kinds[i] as SegmentKind;
      const pa = ring.points[i] as RingPoint;
      const pb = ring.points[next] as RingPoint;
      const xc = (pa.x + pb.x) / 2;
      if (kind === 'deck' && holes.some((h) => inside(h, xc, zc))) continue;

      const group =
        kind === 'under'
          ? LOWER_BODY_GROUP.under
          : kind === 'deck' && zc > p.hood.zStart && zc < p.hood.zEnd
            ? LOWER_BODY_GROUP.hood
            : LOWER_BODY_GROUP.body;
      const a = vid(k, outCol[i] as number);
      const bb = vid(k, inCol[next] as number);
      const c = vid(k + 1, inCol[next] as number);
      const d = vid(k + 1, outCol[i] as number);
      (b.buckets[group] as number[]).push(a, bb, c, a, c, d);
    }
  }

  // Ön ve arka kapaklar (düz yüzey, ayrı vertex'ler).
  const cap = (ring: Ring, z: number, front: boolean) => {
    const cx = 0;
    const cy = ring.points.reduce((sum, pt) => sum + pt.y, 0) / ring.points.length;
    const center = addVertex(b, cx, cy, z);
    const ids = ring.points.map((pt) => addVertex(b, pt.x, pt.y, z));
    const bucket = b.buckets[LOWER_BODY_GROUP.body] as number[];
    for (let i = 0; i < ids.length; i++) {
      const i0 = ids[i] as number;
      const i1 = ids[(i + 1) % ids.length] as number;
      if (front) bucket.push(center, i0, i1);
      else bucket.push(center, i1, i0);
    }
  };
  cap(rings[n - 1] as Ring, zs[n - 1] as number, true);
  cap(first, zs[0] as number, false);

  return finish(b);
}

export function buildCabinGeometry(s: BodySampler): BufferGeometry {
  const c = s.profile.cabin;
  const n = c.stations;
  const r = c.ringSamples;
  const zs = Array.from({ length: n }, (_, k) => c.zStart + ((c.zEnd - c.zStart) * k) / (n - 1));

  // Halka: sağ taban -> tavan ortası -> sol taban. thetas[j] her noktanın açısı.
  const thetas: number[] = [];
  for (let j = 0; j <= r; j++) thetas.push((Math.PI / 2) * (j / r));
  for (let j = r - 1; j >= 0; j--) thetas.push((Math.PI / 2) * (j / r));
  const ringSize = thetas.length;

  const b = newBuilder(3);
  zs.forEach((z) => {
    const roof = s.roofY(z);
    thetas.forEach((theta, idx) => {
      const sideSign = idx <= r ? 1 : -1;
      const sv = superellipse(Math.sin(theta), c.exponent);
      const cv = superellipse(Math.cos(theta), c.exponent);
      const x = theta >= Math.PI / 2 ? 0 : sideSign * cv * s.cabinHalfWidth(z, sv);
      addVertex(b, x, c.baseY + (roof - c.baseY) * sv, z);
    });
  });

  const within = (range: [number, number], v: number) => v > range[0] && v < range[1];
  for (let k = 0; k < n - 1; k++) {
    const zc = ((zs[k] as number) + (zs[k + 1] as number)) / 2;
    for (let i = 0; i < ringSize - 1; i++) {
      const theta = ((thetas[i] as number) + (thetas[i + 1] as number)) / 2;
      const top = theta > c.topAngle;
      // Üst yüzler: ön/arka cam veya tavan. Yan yüzler: yan cam veya boyalı direk/panel.
      // Üst ile yan arasındaki bant A/B/C direği olarak boyanır.
      const pillar = !top && theta > c.topAngle - c.pillarAngle;
      let group: number = CABIN_GROUP.body;
      if (top)
        group =
          within(c.windshield, zc) || within(c.rearGlass, zc)
            ? CABIN_GROUP.glass
            : CABIN_GROUP.roof;
      else if (!pillar && within(c.sideGlass, zc) && theta > c.beltAngle) group = CABIN_GROUP.glass;

      const a = k * ringSize + i;
      const bb = k * ringSize + i + 1;
      const cc = (k + 1) * ringSize + i + 1;
      const d = (k + 1) * ringSize + i;
      (b.buckets[group] as number[]).push(a, bb, cc, a, cc, d);
    }
  }
  return finish(b);
}

/** Aynı araç + seçenek için geometri bir kez üretilir. */
export const getLowerBodyGeometry = memoize(
  (carId: string, _s: BodySampler, opts: LowerBodyOptions) => `${carId}|cutout=${opts.hoodCutout}`,
  (_carId: string, s: BodySampler, opts: LowerBodyOptions) => buildLowerBodyGeometry(s, opts),
);

export const getCabinGeometry = memoize(
  (carId: string, _s: BodySampler) => carId,
  (_carId: string, s: BodySampler) => buildCabinGeometry(s),
);
