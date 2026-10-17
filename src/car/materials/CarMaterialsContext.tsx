import { useEffect, useMemo, type ReactNode } from 'react';
import { createCarMaterials, disposeCarMaterials } from './carMaterials';
import { CarMaterialsContext } from './useCarMaterials';

export function CarMaterialsProvider({
  paintZones,
  children,
}: {
  paintZones: string[];
  children: ReactNode;
}) {
  const key = paintZones.join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- bölge listesi içerikle anahtarlanır
  const materials = useMemo(() => createCarMaterials(paintZones), [key]);
  useEffect(() => () => disposeCarMaterials(materials), [materials]);
  return <CarMaterialsContext.Provider value={materials}>{children}</CarMaterialsContext.Provider>;
}
