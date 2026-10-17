import { useEffect, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useEffectiveVinyl } from '../../core/store/stores';
import { useCarVinyl } from '../../car/materials/useCarMaterials';
import { applyVinylLayers } from '../../car/materials/vinylUniforms';

/**
 * Vinil katmanlarını yüzey dokularına basar ve car-space dönüşümünü boya shader'ına
 * iletir (araç döner tabla / lastik yükselmesiyle hareket ettiği için her kare).
 */
export function VinylRuntime({ root }: { root: RefObject<Group | null> }) {
  const layers = useEffectiveVinyl();
  const { textures, uniforms } = useCarVinyl();

  useEffect(() => applyVinylLayers(textures, uniforms, layers), [layers, textures, uniforms]);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    g.updateWorldMatrix(true, false);
    uniforms.uCarInverse.value.copy(g.matrixWorld).invert();
  });

  return null;
}
