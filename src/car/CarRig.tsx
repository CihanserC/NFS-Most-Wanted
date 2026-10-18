import { useEffect, useRef, type RefObject } from 'react';
import type { Group } from 'three';
import { bodyLift } from '../core/wheels/fitment';
import { stanceBodyOffset } from '../core/stance/stance';
import {
  useBuildStore,
  useEffectiveFitment,
  useEffectiveLook,
  useEffectiveParts,
} from '../core/store/stores';
import { getCar } from '../data/cars';
import { useVinylPicking } from '../vinyl/editor/useVinylPicking';
import { VinylGizmo } from '../vinyl/editor/VinylGizmo';
import { VinylRuntime } from '../vinyl/render/VinylRuntime';
import { trackLimitMm } from './fitmentBody';
import type { WheelPose } from './wheelPose';
import { Underglow } from './lighting/Underglow';
import { LookSync } from './materials/LookSync';
import { CarMaterialsProvider } from './materials/CarMaterialsContext';
import { PaintSync } from './materials/PaintSync';
import { PlaceholderBody } from './procedural/PlaceholderBody';
import { ProceduralWheels } from './procedural/wheels/ProceduralWheels';
import { slotRenderers } from './slots/registry';
import { isRenderedSlot } from './slots/slotIds';

/** Manifest + BuildState -> 3D araç. */
export function CarRig({ drive }: { drive?: { poses: RefObject<WheelPose[]> } }) {
  const carId = useBuildStore((s) => s.build.carId);
  const car = getCar(carId);
  const parts = useEffectiveParts();
  const fitment = useEffectiveFitment();
  const { stance, lighting } = useEffectiveLook();
  const slotIds = Object.keys(car.manifest.slots);
  const { wheels, dimensions } = car.manifest;
  // Lastik büyüdükçe gövde yükselir; ön/arka farkı eğim (rake) verir.
  const { lift, pitch } = bodyLift(
    fitment,
    { front: wheels.FL.position[1], rear: wheels.RL.position[1] },
    dimensions.wheelbase,
  );
  // Süspansiyon: gövde tekerleklere göre hareket eder, tekerlekler yerde kalır.
  const body = stanceBodyOffset(stance, dimensions.wheelbase);
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
      <LookSync />
      <VinylRuntime root={root} />
      <group position-y={lift} rotation-x={pitch}>
        <ProceduralWheels
          car={car}
          fitment={fitment}
          stance={stance}
          trackLimitMm={trackLimitMm(car, parts)}
          poses={drive?.poses}
        />
        <Underglow car={car} underglow={lighting.underglow} bodyLiftM={body.lift} />
        <group
          ref={root}
          name={car.manifest.id}
          position-y={body.lift}
          rotation-x={body.pitch}
          onClick={drive ? undefined : vinylPicking.onClick}
          onPointerMissed={drive ? undefined : vinylPicking.onPointerMissed}
        >
          <PlaceholderBody car={car} parts={parts} />
          {slotIds.filter(isRenderedSlot).map((slotId) => {
            const Renderer = slotRenderers[slotId];
            const option = parts[slotId];
            if (option === undefined) return null;
            return <Renderer key={slotId} option={option} parts={parts} car={car} />;
          })}
          {!drive && <VinylGizmo root={root} box={box} />}
        </group>
      </group>
    </CarMaterialsProvider>
  );
}
