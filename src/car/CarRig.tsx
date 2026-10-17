import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import { bodyLift } from '../core/wheels/fitment';
import { useBuildStore, useEffectiveFitment, useEffectiveParts } from '../core/store/stores';
import { getCar } from '../data/cars';
import { useVinylPicking } from '../vinyl/editor/useVinylPicking';
import { VinylGizmo } from '../vinyl/editor/VinylGizmo';
import { VinylRuntime } from '../vinyl/render/VinylRuntime';
import { CarMaterialsProvider } from './materials/CarMaterialsContext';
import { PaintSync } from './materials/PaintSync';
import { PlaceholderBody } from './procedural/PlaceholderBody';
import { ProceduralWheels } from './procedural/wheels/ProceduralWheels';
import { slotRenderers } from './slots/registry';
import { isRenderedSlot } from './slots/slotIds';

/** Manifest + BuildState -> 3D araç. */
export function CarRig() {
  const carId = useBuildStore((s) => s.build.carId);
  const car = getCar(carId);
  const parts = useEffectiveParts();
  const fitment = useEffectiveFitment();
  const slotIds = Object.keys(car.manifest.slots);
  const { wheels, dimensions } = car.manifest;
  // Lastik büyüdükçe gövde yükselir; ön/arka farkı eğim (rake) verir.
  const { lift, pitch } = bodyLift(
    fitment,
    { front: wheels.FL.position[1], rear: wheels.RL.position[1] },
    dimensions.wheelbase,
  );
  /** Car-space kökü: vinil projeksiyonu ve gizmo bu grubun koordinatlarında çalışır. */
  const root = useRef<Group>(null);
  const box = car.vinylBox;
  const vinylPicking = useVinylPicking(root, box);

  useEffect(() => {
    if (car.manifest.model !== null)
      console.warn(
        `[CarRig] ${car.manifest.id}: GLB modeli Faz 10'da desteklenecek, placeholder çiziliyor.`,
      );
    const missing = Object.keys(car.manifest.slots).filter((id) => !isRenderedSlot(id));
    if (missing.length > 0) console.warn(`[CarRig] Çizimi olmayan slotlar: ${missing.join(', ')}`);
  }, [car]);

  return (
    <CarMaterialsProvider paintZones={car.manifest.paintZones} dimensions={dimensions}>
      <PaintSync />
      <VinylRuntime root={root} />
      <group
        ref={root}
        name={car.manifest.id}
        position-y={lift}
        rotation-x={pitch}
        onClick={vinylPicking.onClick}
        onPointerMissed={vinylPicking.onPointerMissed}
      >
        <PlaceholderBody car={car} parts={parts} />
        <ProceduralWheels car={car} fitment={fitment} />
        {slotIds.filter(isRenderedSlot).map((slotId) => {
          const Renderer = slotRenderers[slotId];
          const option = parts[slotId];
          if (option === undefined) return null;
          return <Renderer key={slotId} option={option} parts={parts} car={car} />;
        })}
        <VinylGizmo root={root} box={box} />
      </group>
    </CarMaterialsProvider>
  );
}
