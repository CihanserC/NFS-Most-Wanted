import { useMemo } from 'react';
import type { CarDefinition } from '../../data/cars';
import { paintFor } from '../materials/carMaterials';
import { useCarMaterials } from '../materials/useCarMaterials';
import { getCabinGeometry, getLowerBodyGeometry } from './bodyGeometry';

export function PlaceholderBody({
  car,
  parts,
}: {
  car: CarDefinition;
  parts: Record<string, string>;
}) {
  const m = useCarMaterials();
  const hoodCutout = parts.hood === 'blower_cutout';
  const lower = getLowerBodyGeometry(car.manifest.id, car.body, { hoodCutout });
  const cabin = getCabinGeometry(car.manifest.id, car.body);

  // Dizi sırası LOWER_BODY_GROUP / CABIN_GROUP indeksleriyle aynı olmalı.
  const lowerMaterials = useMemo(
    () => [paintFor(m, 'body'), paintFor(m, 'hood'), m.underbody],
    [m],
  );
  const roofMaterial = parts.roof === 'vinyl_top' ? m.vinylTop : paintFor(m, 'roof');
  const cabinMaterials = useMemo(
    () => [paintFor(m, 'body'), roofMaterial, m.glass],
    [m, roofMaterial],
  );

  return (
    <group>
      <mesh geometry={lower} material={lowerMaterials} castShadow receiveShadow />
      <mesh geometry={cabin} material={cabinMaterials} castShadow />
    </group>
  );
}
