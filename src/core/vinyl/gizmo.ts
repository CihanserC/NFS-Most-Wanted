import { vinylConfig, type ProjectionSurface } from './projection';
import type { VinylLayer } from './types';

/**
 * Gizmo sürükleme hesapları (saf). Tüm noktalar yüzey (u, v) koordinatında gelir;
 * hesaplar yüzey metresinde yapılır ki en-boy oranı bozulmasın.
 */
export type GizmoHandle = 'move' | 'scale' | 'rotate' | 'skewX' | 'skewY';

export type DragStart = {
  handle: GizmoHandle;
  layer: VinylLayer;
  /** Sürüklemenin başladığı nokta (u, v) */
  startUV: [number, number];
};

/** Kaydırırken açı yakalama adımı (derece) */
export const ROTATION_SNAP_DEG = 15;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** (u, v) -> katman merkezine göre, katmanın dönmüş eksenlerinde metre cinsinden konum. */
function toLocal(
  layer: VinylLayer,
  surface: ProjectionSurface,
  uv: [number, number],
): [number, number] {
  const dx = (uv[0] - layer.position[0]) * surface.widthM;
  const dy = (uv[1] - layer.position[1]) * surface.heightM;
  const r = (-layer.rotationDeg * Math.PI) / 180;
  return [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)];
}

/** Sürükleme sonucunda katmanın yeni hali. uniform: ölçekte en-boy oranını koru / açıyı yakala. */
export function dragLayer(
  start: DragStart,
  surface: ProjectionSurface,
  uv: [number, number],
  uniform = false,
): VinylLayer {
  const l = start.layer;
  const size = vinylConfig.baseShapeSizeM;
  const { scale: sl, skew: kl } = vinylConfig.limits;

  switch (start.handle) {
    case 'move':
      return {
        ...l,
        position: [
          l.position[0] + uv[0] - start.startUV[0],
          l.position[1] + uv[1] - start.startUV[1],
        ],
      };

    case 'scale': {
      const [x, y] = toLocal(l, surface, uv);
      if (uniform) {
        const [x0, y0] = toLocal(l, surface, start.startUV);
        const k = Math.hypot(x, y) / Math.max(1e-6, Math.hypot(x0, y0));
        return {
          ...l,
          scale: [clamp(l.scale[0] * k, sl.min, sl.max), clamp(l.scale[1] * k, sl.min, sl.max)],
        };
      }
      // Köşe tutamağı merkezden yarım boy uzakta: boy = 2 × |yerel konum|.
      return {
        ...l,
        scale: [
          clamp((2 * Math.abs(x)) / size, sl.min, sl.max),
          clamp((2 * Math.abs(y)) / size, sl.min, sl.max),
        ],
      };
    }

    case 'rotate': {
      const angle = (uvv: [number, number]) =>
        Math.atan2(
          (uvv[1] - l.position[1]) * surface.heightM,
          (uvv[0] - l.position[0]) * surface.widthM,
        );
      let deg = l.rotationDeg + ((angle(uv) - angle(start.startUV)) * 180) / Math.PI;
      if (uniform) deg = Math.round(deg / ROTATION_SNAP_DEG) * ROTATION_SNAP_DEG;
      return { ...l, rotationDeg: ((deg % 360) + 360) % 360 };
    }

    case 'skewX': {
      // Üst-orta tutamak: yatay kayma, tan(eğim) = kayma / (yarı yükseklik)
      const [x] = toLocal(l, surface, uv);
      const halfH = (l.scale[1] * size) / 2;
      return { ...l, skew: [clamp(Math.atan2(x, halfH), kl.min, kl.max), l.skew[1]] };
    }

    case 'skewY': {
      // Sağ-orta tutamak: dikey kayma
      const [, y] = toLocal(l, surface, uv);
      const halfW = (l.scale[0] * size) / 2;
      return { ...l, skew: [l.skew[0], clamp(Math.atan2(y, halfW), kl.min, kl.max)] };
    }
  }
}
