import { useEffect } from 'react';
import { useQualityPreset } from '../../core/store/graphicsStore';
import { useEffectivePaint } from '../../core/store/stores';
import { applyPaint } from './carPaintMaterial';
import { useCarMaterials } from './useCarMaterials';

/** BuildState.paint (+ önizleme) değiştikçe boya materyallerini günceller. Çizim yapmaz. */
export function PaintSync() {
  const materials = useCarMaterials();
  const paint = useEffectivePaint();
  const { flakes } = useQualityPreset();
  useEffect(() => {
    for (const [zone, config] of Object.entries(paint)) {
      const mat = materials.paint[zone];
      if (mat) applyPaint(mat, flakes ? config : { ...config, flakeDensity: 0 });
    }
  }, [materials, paint, flakes]);
  return null;
}
