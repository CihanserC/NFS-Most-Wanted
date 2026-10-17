import type { RefObject } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Group, Object3D } from 'three';
import {
  carToSurface,
  dominantSide,
  hitTestLayers,
  type ProjectionBox,
} from '../../core/vinyl/projection';
import { addLayer, createLayer, LayerLimitError } from '../../core/vinyl/layers';
import { useAppStore } from '../../core/store/appStore';
import { useBuildStore } from '../../core/store/stores';
import { categoryKind } from '../../garage/ui/categories';
import { GIZMO_FLAG } from './gizmoFlag';

/** Tıklama ile sürükleme (orbit) ayrımı: bu kadar pikselden fazla hareket tıklama değildir. */
const CLICK_MAX_DRAG_PX = 5;

/**
 * Vinil editörü açıkken araca tıklama: "yerleştir" aracında seçili şekli tıklanan yüzeye
 * koyar; "seç" aracında altındaki en üst katmanı seçer. Editör kapalıyken boş nesne döner
 * (olay işleyicisi olmayınca R3F araç için raycast yapmaz).
 */
export function useVinylPicking(
  root: RefObject<Group | null>,
  box: ProjectionBox,
): {
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerMissed?: () => void;
} {
  const active = useAppStore((s) => categoryKind(s.categoryId) === 'vinyl');
  if (!active) return {};

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const g = root.current;
    if (!g || !e.face || e.delta > CLICK_MAX_DRAG_PX) return;
    e.stopPropagation();
    for (let o: Object3D | null = e.object; o; o = o.parent) if (o.userData[GIZMO_FLAG]) return;
    const point = g.worldToLocal(e.point.clone());
    const normal = e.face.normal
      .clone()
      .transformDirection(e.object.matrixWorld)
      .transformDirection(g.matrixWorld.clone().invert());
    const side = dominantSide([normal.x, normal.y, normal.z]);
    if (!side) return;
    const uv = carToSurface(box, side, [point.x, point.y, point.z]);
    const app = useAppStore.getState();
    const store = useBuildStore.getState();
    const layers = store.build.vinyl;

    if (app.vinylTool === 'select') {
      app.selectLayer(hitTestLayers(layers, box, side, uv));
      return;
    }
    try {
      const layer = createLayer(app.vinylShapeId, side, uv, { color: app.vinylColor });
      store.setVinyl(addLayer(layers, layer));
      app.selectLayer(layer.id);
    } catch (err) {
      if (!(err instanceof LayerLimitError)) throw err;
      console.warn(err.message);
    }
  };

  /** Seç aracında boşluğa tıklayınca seçimi bırak. */
  const onPointerMissed = () => {
    if (useAppStore.getState().vinylTool === 'select') useAppStore.getState().selectLayer(null);
  };

  return { onClick, onPointerMissed };
}
