import { BufferGeometry, LatheGeometry, Vector2 } from 'three';
import { lruMemoize } from '../../../core/cache/lru';
import { inch, rimMetrics, WHEEL_DIM } from '../../../core/wheels/dimensions';
import type { TireConfig, WheelConfig } from '../../../core/wheels/types';
import { tireOuterRadiusM } from '../../../core/wheels/wheels';

/** Lastik: iç yanak, sırt (diş) ve dış yanak ayrı mesh'ler (farklı doku/materyal). */
export type TireGeometries = {
  innerSidewall: BufferGeometry;
  tread: BufferGeometry;
  /** v=0 omuz, v=1 topuk (yanak yazısı dokusu buna göre çizilir) */
  outerSidewall: BufferGeometry;
};

const SEGMENTS = 72;
const SIDEWALL_STEPS = 10;
const SHOULDER_STEPS = 5;
const TREAD_STEPS = 6;
/** Sırt genişliği / lastik genişliği */
const TREAD_RATIO = 0.88;
/** Dolgun lastikte yanak şişkinliği (genişlik farkının oranı) */
const BULGE_RATIO = 0.15;
const MAX_SHOULDER_RADIUS = 0.025;

type Pt = [number, number];

/**
 * Lastik kesit profili (r, z), lastik merkez hattına göre. Sıra: iç topuk -> iç yanak ->
 * omuz -> sırt -> omuz -> dış yanak -> dış topuk. Bu sıra LatheGeometry normallerinin
 * dışa bakmasını sağlar.
 */
export function tireProfile(
  w: WheelConfig,
  t: TireConfig,
): { inner: Pt[]; tread: Pt[]; outer: Pt[] } {
  const R = rimMetrics(w).rimRadius + WHEEL_DIM.flangeHeight * 0.5;
  const Ro = tireOuterRadiusM(w.diameterIn, t);
  const tireW = t.widthMm / 1000;
  const rimW = inch(w.widthIn);
  const bead = rimW / 2 - WHEEL_DIM.flangeWidth * 0.5;
  const tw = (tireW / 2) * TREAD_RATIO;
  const rs = Math.min(MAX_SHOULDER_RADIUS, (Ro - R) / 3, tw / 2);
  // Yanak lastik genişliğine kadar açılır; dolgun lastikte biraz daha şişer.
  const widest = tireW / 2 + Math.max(0, tireW - rimW) * BULGE_RATIO;
  const bulge = Math.max(0, widest - (bead + tw) / 2);

  // Topuktan omuza: + taraf (dış). İç taraf z'nin negatifi.
  const side: Pt[] = [];
  for (let i = 0; i <= SIDEWALL_STEPS; i++) {
    const s = i / SIDEWALL_STEPS;
    side.push([R + (Ro - rs - R) * s, bead + (tw - bead) * s + bulge * Math.sin(Math.PI * s)]);
  }
  const shoulder: Pt[] = [];
  for (let i = 1; i <= SHOULDER_STEPS; i++) {
    const a = (i / SHOULDER_STEPS) * (Math.PI / 2);
    shoulder.push([Ro - rs + rs * Math.sin(a), tw - rs + rs * Math.cos(a)]);
  }
  const outerHalf = [...side, ...shoulder]; // topuk -> sırt kenarı
  const treadEdge = tw - rs;
  const tread: Pt[] = [];
  for (let i = 0; i <= TREAD_STEPS; i++)
    tread.push([Ro, -treadEdge + (2 * treadEdge * i) / TREAD_STEPS]);

  return {
    inner: outerHalf.map(([r, z]) => [r, -z] as Pt),
    tread,
    outer: [...outerHalf].reverse(),
  };
}

function lathe(points: Pt[], centerZ: number): BufferGeometry {
  const g = new LatheGeometry(
    points.map(([r, z]) => new Vector2(r, z)),
    SEGMENTS,
  );
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, centerZ);
  return g;
}

function buildTire(w: WheelConfig, t: TireConfig): TireGeometries {
  const p = tireProfile(w, t);
  const cz = rimMetrics(w).centerZ;
  return {
    innerSidewall: lathe(p.inner, cz),
    tread: lathe(p.tread, cz),
    outerSidewall: lathe(p.outer, cz),
  };
}

export const tireKey = (w: WheelConfig, t: TireConfig) =>
  [w.diameterIn, w.widthIn, w.offsetMm, t.widthMm, t.aspect].join('|');

export const getTireGeometry = lruMemoize(tireKey, buildTire, {
  max: 24,
  onEvict: (g) => {
    g.innerSidewall.dispose();
    g.tread.dispose();
    g.outerSidewall.dispose();
  },
});

export { buildTire };
