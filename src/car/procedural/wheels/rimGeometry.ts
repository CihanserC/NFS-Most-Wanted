import {
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Path,
  Shape,
  Vector2,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lruMemoize } from '../../../core/cache/lru';
import { dishZ, rimMetrics, WHEEL_DIM } from '../../../core/wheels/dimensions';
import type { WheelConfig } from '../../../core/wheels/types';

/**
 * Prosedürel jant. Tüm geometriler tekerlek yerel uzayında: orijin göbek bağlantı
 * yüzeyi, eksen +z (dışarı).
 */
export type RimGeometries = {
  /** İç namlu (yüz kenarından içerideki flanşa) */
  barrel: BufferGeometry;
  /** Dış dudak (yüz kenarından dış flanşa) — iki tonlu kaplamada işlenmiş kısım */
  lip: BufferGeometry;
  /** Kollar / jant yüzü */
  face: BufferGeometry;
  lugs: BufferGeometry;
  /** Merkez kapak (çelik jantta dog-dish kapak) */
  cap: BufferGeometry;
  /** 3 parçalı jantın cıvataları; diğer stillerde null */
  rivets: BufferGeometry | null;
};

/** Stil başına kol ölçüleri (m) ve eğri çözünürlüğü. */
const STYLE = {
  classic_5spoke: { spokeIn: 0.05, spokeOut: 0.034 },
  modern_multispoke: { spokeIn: 0.02, spokeOut: 0.013 },
  deep_dish_3pc: { spokeIn: 0.04, spokeOut: 0.028 },
  mesh: { bar: 0.008, hubRadius: 0.095 },
  steel_dogdish: { ventRadius: 0.017, ventAt: 0.82, dishRadius: 0.42, dishHeight: 0.03 },
  drag: { holeFill: 0.42 },
} as const;

const CURVE_SEGMENTS = 10;
const LATHE_SEGMENTS = 56;
const LUG = { radius: 0.011, height: 0.022, sides: 6 };
const RIVET = { count: 30, radius: 0.0045, height: 0.006 };
/** Kolların aynı düzlemde z-fighting yapmaması için çapraz setin kalınlık farkı */
const MESH_LAYER_OFFSET = 0.002;

const polar = (r: number, a: number) => new Vector2(r * Math.cos(a), r * Math.sin(a));

/** İki kol arasındaki pencere (delik) yolu. */
function spokeWindow(
  rIn: number,
  rOut: number,
  a0: number,
  a1: number,
  spokeIn: number,
  spokeOut: number,
): Path {
  const aIn = spokeIn / 2 / rIn;
  const aOut = spokeOut / 2 / rOut;
  const p = new Path();
  const start = polar(rIn, a0 + aIn);
  p.moveTo(start.x, start.y);
  const o0 = polar(rOut, a0 + aOut);
  p.lineTo(o0.x, o0.y);
  p.absarc(0, 0, rOut, a0 + aOut, a1 - aOut, false);
  const i1 = polar(rIn, a1 - aIn);
  p.lineTo(i1.x, i1.y);
  p.absarc(0, 0, rIn, a1 - aIn, a0 + aIn, true);
  return p;
}

function circlePath(cx: number, cy: number, r: number): Path {
  const p = new Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, false);
  return p;
}

function discShape(radius: number): Shape {
  const s = new Shape();
  s.absarc(0, 0, radius, 0, Math.PI * 2, false);
  return s;
}

/** Kollu stiller: dolu disk eksi kol pencereleri. Kol genişliği sığmazsa daraltılır. */
function spokedFace(w: WheelConfig, spokeIn: number, spokeOut: number): Shape {
  const m = rimMetrics(w);
  const rIn = WHEEL_DIM.windowInnerRadius;
  const rOut = m.windowOuterRadius;
  const n = w.spokes;
  const pitchIn = (2 * Math.PI * rIn) / n;
  const pitchOut = (2 * Math.PI * rOut) / n;
  const wIn = Math.min(spokeIn, pitchIn * 0.7);
  const wOut = Math.min(spokeOut, pitchOut * 0.7);
  const shape = discShape(m.faceRadius);
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + Math.PI / 2;
    const a1 = ((i + 1) / n) * Math.PI * 2 + Math.PI / 2;
    shape.holes.push(spokeWindow(rIn, rOut, a0, a1, wIn, wOut));
  }
  return shape;
}

function steelFace(w: WheelConfig): Shape {
  const m = rimMetrics(w);
  const s = STYLE.steel_dogdish;
  const shape = discShape(m.faceRadius);
  const at = m.windowOuterRadius * s.ventAt;
  for (let i = 0; i < w.spokes; i++) {
    const p = polar(at, (i / w.spokes) * Math.PI * 2);
    shape.holes.push(circlePath(p.x, p.y, s.ventRadius));
  }
  return shape;
}

function dragFace(w: WheelConfig): Shape {
  const m = rimMetrics(w);
  const rIn = WHEEL_DIM.windowInnerRadius;
  const rOut = m.windowOuterRadius;
  const rc = (rIn + rOut) / 2;
  const holeR = Math.min(STYLE.drag.holeFill * (rOut - rIn), (0.8 * Math.PI * rc) / w.spokes);
  const shape = discShape(m.faceRadius);
  for (let i = 0; i < w.spokes; i++) {
    const p = polar(rc, (i / w.spokes) * Math.PI * 2 + Math.PI / 2);
    shape.holes.push(circlePath(p.x, p.y, holeR));
  }
  return shape;
}

/** Örgü (mesh) jant: dış halka + göbek + iki yönde çapraz ince kollar. */
function meshFaceGeometry(w: WheelConfig): BufferGeometry {
  const m = rimMetrics(w);
  const s = STYLE.mesh;
  const rOut = m.windowOuterRadius;
  const ring = discShape(m.faceRadius);
  ring.holes.push(circlePath(0, 0, rOut));
  const hub = discShape(s.hubRadius);
  const twist = Math.PI / w.spokes;

  const bars = (dir: 1 | -1) =>
    Array.from({ length: w.spokes }, (_, i) => {
      const a = (i / w.spokes) * Math.PI * 2;
      const from = polar(s.hubRadius * 0.85, a);
      const to = polar(rOut + 0.004, a + dir * twist);
      const n = new Vector2(-(to.y - from.y), to.x - from.x).normalize().multiplyScalar(s.bar / 2);
      return new Shape([
        from.clone().add(n),
        to.clone().add(n),
        to.clone().sub(n),
        from.clone().sub(n),
      ]);
    });

  const extrude = (shapes: Shape[], depth: number) =>
    new ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: CURVE_SEGMENTS * 2 });
  const t = WHEEL_DIM.faceThickness;
  const parts = [
    extrude([ring, hub], t),
    extrude(bars(1), t - MESH_LAYER_OFFSET),
    extrude(bars(-1), t - MESH_LAYER_OFFSET * 2),
  ];
  const merged = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  if (!merged) throw new Error('Örgü jant geometrisi birleştirilemedi');
  return merged;
}

function faceShape(w: WheelConfig): Shape {
  switch (w.style) {
    case 'classic_5spoke':
      return spokedFace(w, STYLE.classic_5spoke.spokeIn, STYLE.classic_5spoke.spokeOut);
    case 'modern_multispoke':
      return spokedFace(w, STYLE.modern_multispoke.spokeIn, STYLE.modern_multispoke.spokeOut);
    case 'deep_dish_3pc':
      return spokedFace(w, STYLE.deep_dish_3pc.spokeIn, STYLE.deep_dish_3pc.spokeOut);
    case 'steel_dogdish':
      return steelFace(w);
    case 'drag':
      return dragFace(w);
    case 'mesh':
      throw new Error('mesh stili ayrı üretilir');
  }
}

/** Düz yüzü dish/konkav profile büker. */
function applyDish(g: BufferGeometry, w: WheelConfig): BufferGeometry {
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, pos.getZ(i) + dishZ(w, Math.hypot(x, y)));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function buildFace(w: WheelConfig): BufferGeometry {
  const face =
    w.style === 'mesh'
      ? meshFaceGeometry(w)
      : new ExtrudeGeometry(faceShape(w), {
          depth: WHEEL_DIM.faceThickness,
          bevelEnabled: true,
          bevelThickness: 0.003,
          bevelSize: 0.002,
          bevelSegments: 1,
          curveSegments: CURVE_SEGMENTS,
        });
  return applyDish(face, w);
}

/** (r, z) profilini z ekseni etrafında döndürür. */
function lathe(points: [number, number][], segments = LATHE_SEGMENTS): BufferGeometry {
  const g = new LatheGeometry(
    points.map(([r, z]) => new Vector2(r, z)),
    segments,
  );
  g.rotateX(Math.PI / 2);
  return g;
}

function buildBarrelAndLip(w: WheelConfig): { barrel: BufferGeometry; lip: BufferGeometry } {
  const m = rimMetrics(w);
  const R = m.rimRadius;
  const fh = WHEEL_DIM.flangeHeight;
  const fw = WHEEL_DIM.flangeWidth;
  const zIn = m.centerZ - m.halfWidth;
  const zOut = m.centerZ + m.halfWidth;
  // Yüz kenarı flanşlar arasında kalmalı.
  const zSplit = Math.min(zOut - fw, Math.max(zIn + fw, m.faceEdgeZ + WHEEL_DIM.faceThickness));
  return {
    barrel: lathe([
      [R + fh, zIn],
      [R + fh, zIn + fw * 0.5],
      [R, zIn + fw],
      [R, zSplit],
    ]),
    lip: lathe([
      [R, zSplit],
      [R, zOut - fw],
      [R + fh, zOut - fw * 0.5],
      [R + fh, zOut],
      [R + fh * 0.6, zOut + 0.002],
    ]),
  };
}

function ring<T extends BufferGeometry>(
  count: number,
  radius: number,
  z: number,
  make: () => T,
): BufferGeometry {
  const items = Array.from({ length: count }, (_, i) => {
    const g = make();
    const p = polar(radius, (i / count) * Math.PI * 2 + Math.PI / 2);
    g.translate(p.x, p.y, z);
    return g;
  });
  const merged = mergeGeometries(items);
  for (const g of items) g.dispose();
  if (!merged) throw new Error('Halka geometrisi birleştirilemedi');
  return merged;
}

const cylinderZ = (radius: number, height: number, sides: number) => {
  const g = new CylinderGeometry(radius, radius, height, sides);
  g.rotateX(Math.PI / 2);
  return g;
};

function buildCap(w: WheelConfig): BufferGeometry {
  const front = WHEEL_DIM.faceThickness;
  if (w.style === 'steel_dogdish') {
    const s = STYLE.steel_dogdish;
    const r = rimMetrics(w).rimRadius * s.dishRadius;
    // Sığ kubbe: kenardan merkeze yükselen profil.
    const pts: [number, number][] = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push([r * (1 - t) + 0.0005, front + 0.004 + s.dishHeight * Math.sin((t * Math.PI) / 2)]);
    }
    return lathe(pts);
  }
  const g = cylinderZ(WHEEL_DIM.centerCapRadius, 0.012, 32);
  g.translate(0, 0, front + 0.006);
  return g;
}

function buildRim(w: WheelConfig): RimGeometries {
  const m = rimMetrics(w);
  const { barrel, lip } = buildBarrelAndLip(w);
  return {
    barrel,
    lip,
    face: buildFace(w),
    lugs: ring(
      WHEEL_DIM.lugCount,
      WHEEL_DIM.lugCircleRadius,
      WHEEL_DIM.faceThickness + LUG.height / 2,
      () => cylinderZ(LUG.radius, LUG.height, LUG.sides),
    ),
    cap: buildCap(w),
    rivets:
      w.style === 'deep_dish_3pc'
        ? ring(
            RIVET.count,
            m.faceRadius - 0.012,
            m.faceEdgeZ + WHEEL_DIM.faceThickness + RIVET.height / 2,
            () => cylinderZ(RIVET.radius, RIVET.height, 8),
          )
        : null,
  };
}

/** Geometriyi etkileyen alanlar (kaplama, renk vb. hariç). */
export const rimKey = (w: WheelConfig) =>
  [w.style, w.diameterIn, w.widthIn, w.offsetMm, w.lipIn, w.spokes].join('|');

export const disposeRim = (r: RimGeometries) => {
  for (const g of [r.barrel, r.lip, r.face, r.lugs, r.cap, r.rivets]) g?.dispose();
};

export const RIM_CACHE_SIZE = 32;

/** Aynı parametrelerle tekrar çağrılınca geometri yeniden üretilmez. */
export const getRimGeometry = lruMemoize(rimKey, buildRim, {
  max: RIM_CACHE_SIZE,
  onEvict: disposeRim,
});

export { buildRim };
