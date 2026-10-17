import vinylConfigJson from '../../data/vinyl/config.json';
import type { Vec3 } from '../math/tuples';
import type { VinylLayer, VinylSide } from './types';

export const vinylConfig = vinylConfigJson as {
  layerLimit: number;
  baseShapeSizeM: number;
  projectionMarginM: number;
  blendSharpness: number;
  resolution: Record<VinylSide, [number, number]>;
  limits: { scale: { min: number; max: number }; skew: { min: number; max: number } };
  defaults: { color: string; scale: [number, number] };
  snap: { grid: number; centerTolerance: number; angleDeg: number };
  nudge: { step: number; bigStep: number };
};

/**
 * Kutu projeksiyonunun bir yüzü. Yüze dışarıdan bakan biri için u sağa, v yukarı artar.
 * Car-space: +X sol, +Y yukarı, +Z ileri.
 */
export type ProjectionSurface = {
  side: VinylSide;
  /** Yüzeyin fiziksel boyutu (m): u ve v yönünde */
  widthM: number;
  heightM: number;
  /** Projeksiyon düzleminin konumu ve dış normali (gizmo bu düzlemde çalışır) */
  planeNormal: Vec3;
  planeOffset: number;
};

export type ProjectionBox = {
  halfLength: number;
  halfWidth: number;
  height: number;
  surfaces: Record<VinylSide, ProjectionSurface>;
};

/** Araç boyutlarından (manifest) projeksiyon kutusu. */
export function createProjectionBox(dims: {
  length: number;
  width: number;
  height: number;
}): ProjectionBox {
  const m = vinylConfig.projectionMarginM;
  const halfLength = dims.length / 2 + m;
  const halfWidth = dims.width / 2 + m;
  const height = dims.height + m;
  const L = halfLength * 2;
  const W = halfWidth * 2;
  return {
    halfLength,
    halfWidth,
    height,
    surfaces: {
      left: {
        side: 'left',
        widthM: L,
        heightM: height,
        planeNormal: [1, 0, 0],
        planeOffset: halfWidth,
      },
      right: {
        side: 'right',
        widthM: L,
        heightM: height,
        planeNormal: [-1, 0, 0],
        planeOffset: halfWidth,
      },
      top: { side: 'top', widthM: W, heightM: L, planeNormal: [0, 1, 0], planeOffset: height },
      front: {
        side: 'front',
        widthM: W,
        heightM: height,
        planeNormal: [0, 0, 1],
        planeOffset: halfLength,
      },
      rear: {
        side: 'rear',
        widthM: W,
        heightM: height,
        planeNormal: [0, 0, -1],
        planeOffset: halfLength,
      },
    },
  };
}

/** Car-space noktayı yüzeyin (u, v) koordinatına çevirir (ortografik, yüz normali boyunca). */
export function carToSurface(box: ProjectionBox, side: VinylSide, p: Vec3): [number, number] {
  const [x, y, z] = p;
  const { halfLength: hl, halfWidth: hw, height: h } = box;
  switch (side) {
    case 'left':
      return [(hl - z) / (2 * hl), y / h];
    case 'right':
      return [(z + hl) / (2 * hl), y / h];
    case 'top':
      return [(hw - x) / (2 * hw), (z + hl) / (2 * hl)];
    case 'front':
      return [(x + hw) / (2 * hw), y / h];
    case 'rear':
      return [(hw - x) / (2 * hw), y / h];
  }
}

/** (u, v) -> projeksiyon düzlemindeki car-space nokta (gizmo çizimi için). */
export function surfaceToCar(box: ProjectionBox, side: VinylSide, u: number, v: number): Vec3 {
  const { halfLength: hl, halfWidth: hw, height: h } = box;
  switch (side) {
    case 'left':
      return [hw, v * h, hl - u * 2 * hl];
    case 'right':
      return [-hw, v * h, u * 2 * hl - hl];
    case 'top':
      return [hw - u * 2 * hw, h, v * 2 * hl - hl];
    case 'front':
      return [u * 2 * hw - hw, v * h, hl];
    case 'rear':
      return [hw - u * 2 * hw, v * h, -hl];
  }
}

/** Yüzey normaline göre hangi projeksiyon yüzüne düştüğü. Aşağı bakan yüzlerde null. */
export function dominantSide(normal: Vec3): VinylSide | null {
  const [x, y, z] = normal;
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (y > ax && y > az) return 'top';
  if (y < 0 && -y > ax && -y > az) return null;
  if (ax >= az) return x >= 0 ? 'left' : 'right';
  return z >= 0 ? 'front' : 'rear';
}

/** 2D afin dönüşüm [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f */
export type Affine = [number, number, number, number, number, number];

/**
 * Katmanın birim kutudaki (±0.5) şeklini yüzey metresine taşıyan dönüşüm. y yukarı.
 * Sıra: ölçek+ayna -> eğme -> döndürme -> öteleme.
 */
export function layerTransform(layer: VinylLayer, surface: ProjectionSurface): Affine {
  const size = vinylConfig.baseShapeSizeM;
  const sx = layer.scale[0] * size * (layer.flipX ? -1 : 1);
  const sy = layer.scale[1] * size * (layer.flipY ? -1 : 1);
  const kx = Math.tan(layer.skew[0]);
  const ky = Math.tan(layer.skew[1]);
  const r = (layer.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  // Eğme * ölçek: [[sx, kx*sy], [ky*sx, sy]]
  const m00 = sx;
  const m01 = kx * sy;
  const m10 = ky * sx;
  const m11 = sy;
  // Döndürme (saat yönünün tersi, y yukarı) * yukarıdaki
  return [
    cos * m00 - sin * m10,
    sin * m00 + cos * m10,
    cos * m01 - sin * m11,
    sin * m01 + cos * m11,
    layer.position[0] * surface.widthM,
    layer.position[1] * surface.heightM,
  ];
}

export function applyAffine(m: Affine, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function invertAffine(m: Affine): Affine | null {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return null;
  const ia = d / det;
  const ib = -b / det;
  const ic = -c / det;
  const id = a / det;
  return [ia, ib, ic, id, -(ia * e + ic * f), -(ib * e + id * f)];
}

/** Katmanın köşe noktaları yüzey (u, v) koordinatında: sol-alt, sağ-alt, sağ-üst, sol-üst. */
export function layerCornersUV(layer: VinylLayer, surface: ProjectionSurface): [number, number][] {
  const m = layerTransform(layer, surface);
  return (
    [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ] as [number, number][]
  ).map(([x, y]) => {
    const [mx, my] = applyAffine(m, x, y);
    return [mx / surface.widthM, my / surface.heightM];
  });
}

/** Simetri karşılığı: sol <-> sağ yüz değişir; üst/ön/arka aynı yüzde orta çizgiye göre ayna. */
export function mirrorSide(side: VinylSide): VinylSide {
  return side === 'left' ? 'right' : side === 'right' ? 'left' : side;
}

/** Çizilecek bir katman örneği (ayna kopyaları dahil). */
export type LayerInstance = {
  /** Çizilecek (ayna kopyasında dönüştürülmüş) katman */
  layer: VinylLayer;
  /** Kaynak katman (değişiklik takibi ve seçim için) */
  source: VinylLayer;
  side: VinylSide;
  mirrored: boolean;
};

/** Yazı ve harf/rakam şekilleri: simetri kopyasında ters (ayna) yazılmaz, okunur kalır. */
export const isReadableShape = (shapeId: string) =>
  shapeId === 'text' || shapeId.startsWith('digit_') || shapeId.startsWith('letter_');

/** Sol/sağ eşlemesinde aynı z için u_sağ = 1 - u_sol; diğer yüzlerde x ayna -> u' = 1 - u. */
export function mirroredLayer(layer: VinylLayer): VinylLayer {
  const readable = isReadableShape(layer.shapeId);
  return {
    ...layer,
    side: mirrorSide(layer.side),
    position: [1 - layer.position[0], layer.position[1]],
    rotationDeg: -layer.rotationDeg,
    skew: readable ? layer.skew : [-layer.skew[0], -layer.skew[1]],
    flipX: readable ? layer.flipX : !layer.flipX,
  };
}

/** Görünür katmanları yüz başına, alttan üste sırayla örneklere ayırır. */
export function instancesBySide(layers: VinylLayer[]): Record<VinylSide, LayerInstance[]> {
  const out: Record<VinylSide, LayerInstance[]> = {
    left: [],
    right: [],
    top: [],
    front: [],
    rear: [],
  };
  for (const layer of layers) {
    if (!layer.visible) continue;
    out[layer.side].push({ layer, source: layer, side: layer.side, mirrored: false });
    if (layer.mirrorToOppositeSide) {
      const m = mirroredLayer(layer);
      out[m.side].push({ layer: m, source: layer, side: m.side, mirrored: true });
    }
  }
  return out;
}

/**
 * Bir yüzeydeki noktanın altındaki en üstteki katman (kaynak katman id'si). Kilitli
 * katmanlar seçilemez. Şeklin sınır kutusuna göre test eder.
 */
export function hitTestLayers(
  layers: VinylLayer[],
  box: ProjectionBox,
  side: VinylSide,
  uv: [number, number],
): string | null {
  const surface = box.surfaces[side];
  const point: [number, number] = [uv[0] * surface.widthM, uv[1] * surface.heightM];
  const candidates = instancesBySide(layers)[side];
  for (let i = candidates.length - 1; i >= 0; i--) {
    const inst = candidates[i] as LayerInstance;
    if (inst.source.locked) continue;
    const inv = invertAffine(layerTransform(inst.layer, surface));
    if (!inv) continue;
    const [lx, ly] = applyAffine(inv, point[0], point[1]);
    if (Math.abs(lx) <= 0.5 && Math.abs(ly) <= 0.5) return inst.source.id;
  }
  return null;
}

/** Şekil yolu koordinat kutusu: SVG path'leri -50..50, y aşağı. */
export const SHAPE_BOX = 100;

/**
 * Şekil (SVG, y aşağı) -> canvas pikseli (y aşağı) dönüşümü; ctx.setTransform'a verilir.
 * Zincir: SVG -> birim kutu (y yukarı) -> yüzey metresi (layerTransform) -> piksel.
 */
export function canvasTransform(
  layer: VinylLayer,
  surface: ProjectionSurface,
  canvasWidth: number,
  canvasHeight: number,
): Affine {
  const [a, b, c, d, e, f] = layerTransform(layer, surface);
  const kx = canvasWidth / surface.widthM;
  const ky = canvasHeight / surface.heightM;
  return [
    (kx * a) / SHAPE_BOX,
    (-ky * b) / SHAPE_BOX,
    (-kx * c) / SHAPE_BOX,
    (ky * d) / SHAPE_BOX,
    kx * e,
    ky * (surface.heightM - f),
  ];
}
