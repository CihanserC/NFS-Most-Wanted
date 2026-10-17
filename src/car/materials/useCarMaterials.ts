import { createContext, useContext } from 'react';
import type { CarMaterials } from './carMaterials';

export const CarMaterialsContext = createContext<CarMaterials | null>(null);

export function useCarMaterials(): CarMaterials {
  const m = useContext(CarMaterialsContext);
  if (!m) throw new Error('useCarMaterials, CarMaterialsProvider içinde kullanılmalı');
  return m;
}
