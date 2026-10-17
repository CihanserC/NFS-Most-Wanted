import { WHEEL_IDS } from '../../core/manifest/types';
import type { CarDefinition } from '../../data/cars';
import { useCarMaterials } from '../materials/useCarMaterials';

/** Faz 3'te prosedürel jant/lastik sistemiyle değiştirilecek basit tekerlekler. */
const WHEEL = {
  tireWidth: 0.235,
  rimRadiusRatio: 0.58,
  rimWidth: 0.2,
  hubRadius: 0.06,
  segments: 40,
};
const AXLE_ALONG_X = Math.PI / 2;

export function PlaceholderWheels({ car }: { car: CarDefinition }) {
  const m = useCarMaterials();
  return (
    <group>
      {WHEEL_IDS.map((id) => {
        const [x, y, z] = car.manifest.wheels[id].position;
        const tireRadius = y;
        const rimRadius = tireRadius * WHEEL.rimRadiusRatio;
        const outward = Math.sign(x);
        return (
          <group key={id} position={[x, y, z]} rotation-z={AXLE_ALONG_X}>
            <mesh material={m.rubber} castShadow>
              <cylinderGeometry args={[tireRadius, tireRadius, WHEEL.tireWidth, WHEEL.segments]} />
            </mesh>
            <mesh position-y={-outward * 0.02} material={m.chrome}>
              <cylinderGeometry
                args={[rimRadius, rimRadius, WHEEL.rimWidth + 0.04, WHEEL.segments]}
              />
            </mesh>
            <mesh position-y={-outward * (WHEEL.rimWidth / 2 + 0.03)} material={m.aluminum}>
              <cylinderGeometry args={[WHEEL.hubRadius, WHEEL.hubRadius, 0.02, 24]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
