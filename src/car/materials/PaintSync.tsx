import { useEffect } from 'react';
import { useEffectivePaint } from '../../core/store/stores';
import { applyPaint } from './carPaintMaterial';
import { useCarMaterials } from './useCarMaterials';

/** BuildState.paint (+ önizleme) değiştikçe boya materyallerini günceller. Çizim yapmaz. */
export function PaintSync() {
  const materials = useCarMaterials();
  const paint = useEffectivePaint();
  useEffect(() => {
    for (const [zone, config] of Object.entries(paint)) {
      const mat = materials.paint[zone];
      if (mat) applyPaint(mat, config);
    }
  }, [materials, paint]);
  return null;
}
