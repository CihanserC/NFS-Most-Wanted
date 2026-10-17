import { useEffect, useMemo, type ReactNode } from 'react';
import { createProjectionBox } from '../../core/vinyl/projection';
import { VinylTextureSet } from '../../vinyl/render/VinylTextureSet';
import { createCarMaterials, disposeCarMaterials } from './carMaterials';
import { CarMaterialsContext, type CarRenderContext } from './useCarMaterials';
import { createVinylUniforms } from './vinylUniforms';

type Dimensions = { length: number; width: number; height: number };

/** Aracın materyalleri ve vinil dokuları (araç başına bir set, unmount'ta dispose). */
export function CarMaterialsProvider({
  paintZones,
  dimensions,
  children,
}: {
  paintZones: string[];
  dimensions: Dimensions;
  children: ReactNode;
}) {
  const key = `${paintZones.join('|')}|${dimensions.length}x${dimensions.width}x${dimensions.height}`;
  const value = useMemo((): CarRenderContext => {
    const box = createProjectionBox(dimensions);
    const textures = new VinylTextureSet(box);
    const uniforms = createVinylUniforms(box, textures.textures);
    return {
      materials: createCarMaterials(paintZones, uniforms),
      vinyl: { box, textures, uniforms },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- içerikle anahtarlanır
  }, [key]);
  useEffect(() => {
    // Geliştirme: vinil dokularını konsoldan incelemek için.
    if (import.meta.env.DEV) Object.assign(window, { __muscleGarageVinyl: value.vinyl });
  }, [value]);
  useEffect(
    () => () => {
      disposeCarMaterials(value.materials);
      value.vinyl.textures.dispose();
    },
    [value],
  );
  return <CarMaterialsContext.Provider value={value}>{children}</CarMaterialsContext.Provider>;
}
