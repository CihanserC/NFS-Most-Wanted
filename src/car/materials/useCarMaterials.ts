import { createContext, useContext } from 'react';
import type { ProjectionBox } from '../../core/vinyl/projection';
import type { VinylTextureSet } from '../../vinyl/render/VinylTextureSet';
import type { CarMaterials } from './carMaterials';
import type { VinylUniforms } from './vinylUniforms';

export type CarRenderContext = {
  materials: CarMaterials;
  vinyl: { box: ProjectionBox; textures: VinylTextureSet; uniforms: VinylUniforms };
};

export const CarMaterialsContext = createContext<CarRenderContext | null>(null);

function useCarRender(): CarRenderContext {
  const m = useContext(CarMaterialsContext);
  if (!m) throw new Error('useCarMaterials, CarMaterialsProvider içinde kullanılmalı');
  return m;
}

export const useCarMaterials = (): CarMaterials => useCarRender().materials;
export const useCarVinyl = () => useCarRender().vinyl;
