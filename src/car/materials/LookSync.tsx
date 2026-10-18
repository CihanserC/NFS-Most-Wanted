import { useEffect } from 'react';
import { useEffectiveLook } from '../../core/store/stores';
import { applyLook } from './carMaterials';
import { useCarMaterials } from './useCarMaterials';

/** Cam filmi ve far rengini materyallere yansıtır. Çizim yapmaz. */
export function LookSync() {
  const materials = useCarMaterials();
  const { glass, lighting } = useEffectiveLook();
  useEffect(() => applyLook(materials, glass, lighting), [materials, glass, lighting]);
  return null;
}
