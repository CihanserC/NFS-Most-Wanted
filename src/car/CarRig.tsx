import { useEffect } from 'react';
import { useBuildStore, useEffectiveParts } from '../core/store/stores';
import { getCar } from '../data/cars';
import { CarMaterialsProvider } from './materials/CarMaterialsContext';
import { PlaceholderBody } from './procedural/PlaceholderBody';
import { PlaceholderWheels } from './procedural/PlaceholderWheels';
import { slotRenderers } from './slots/registry';
import { isRenderedSlot } from './slots/slotIds';

/** Manifest + BuildState -> 3D araç. */
export function CarRig() {
  const carId = useBuildStore((s) => s.build.carId);
  const car = getCar(carId);
  const parts = useEffectiveParts();
  const slotIds = Object.keys(car.manifest.slots);

  useEffect(() => {
    if (car.manifest.model !== null)
      console.warn(
        `[CarRig] ${car.manifest.id}: GLB modeli Faz 10'da desteklenecek, placeholder çiziliyor.`,
      );
    const missing = Object.keys(car.manifest.slots).filter((id) => !isRenderedSlot(id));
    if (missing.length > 0) console.warn(`[CarRig] Çizimi olmayan slotlar: ${missing.join(', ')}`);
  }, [car]);

  return (
    <CarMaterialsProvider paintZones={car.manifest.paintZones}>
      <group name={car.manifest.id}>
        <PlaceholderBody car={car} parts={parts} />
        <PlaceholderWheels car={car} />
        {slotIds.filter(isRenderedSlot).map((slotId) => {
          const Renderer = slotRenderers[slotId];
          const option = parts[slotId];
          if (option === undefined) return null;
          return <Renderer key={slotId} option={option} parts={parts} car={car} />;
        })}
      </group>
    </CarMaterialsProvider>
  );
}
