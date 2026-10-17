import { useEffect, useMemo } from 'react';
import { WHEEL_IDS, type WheelId } from '../../../core/manifest/types';
import type {
  Axle,
  BrakeConfig,
  FitmentState,
  TireConfig,
  WheelConfig,
} from '../../../core/wheels/types';
import { effectiveDiscMm } from '../../../core/wheels/wheels';
import type { CarDefinition } from '../../../data/cars';
import { getBrakeGeometry } from './brakeGeometry';
import { getRimGeometry } from './rimGeometry';
import { getTireGeometry } from './tireGeometry';
import { createBrakeMaterials, createWheelMaterials, disposeMaterials } from './wheelMaterials';

const axleOf = (id: WheelId): Axle => (id === 'FL' || id === 'FR' ? 'front' : 'rear');
/** Kaliper diskin üst-arka çeyreğinde (aracın arkasına doğru 45°). */
const CALIPER_ANGLE_FROM_REAR = Math.PI / 4;

function useWheelMaterials(w: WheelConfig, t: TireConfig) {
  const materials = useMemo(
    () => createWheelMaterials(w, t),
    // Sadece materyali etkileyen alanlar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w.finish, w.color, t.sidewall, t.type],
  );
  useEffect(() => () => disposeMaterials(materials), [materials]);
  return materials;
}

function useBrakeMaterials(b: BrakeConfig) {
  const materials = useMemo(
    () => createBrakeMaterials(b),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [b.rotor, b.caliperColor],
  );
  useEffect(() => () => disposeMaterials(materials), [materials]);
  return materials;
}

function Wheel({
  wheel,
  tire,
  brakes,
  discMm,
  outboardSign,
}: {
  wheel: WheelConfig;
  tire: TireConfig;
  brakes: BrakeConfig;
  discMm: number;
  /** +1: sol tekerlek (dışarı = +x), -1: sağ */
  outboardSign: 1 | -1;
}) {
  const rim = getRimGeometry(wheel);
  const tireGeo = getTireGeometry(wheel, tire);
  const brakeGeo = getBrakeGeometry(brakes, discMm);
  const wm = useWheelMaterials(wheel, tire);
  const bm = useBrakeMaterials(brakes);
  // Yerel +x: sol tekerlekte araç arkası, sağda araç önü.
  const caliperAngle =
    outboardSign > 0 ? CALIPER_ANGLE_FROM_REAR : Math.PI - CALIPER_ANGLE_FROM_REAR;

  return (
    <group rotation-y={(outboardSign * Math.PI) / 2}>
      <mesh geometry={rim.barrel} material={wm.face} castShadow />
      <mesh geometry={rim.lip} material={wm.lip} castShadow />
      <mesh geometry={rim.face} material={wm.face} castShadow />
      {wheel.lugNuts && <mesh geometry={rim.lugs} material={wm.chrome} />}
      {wheel.centerCap && <mesh geometry={rim.cap} material={wm.chrome} />}
      {rim.rivets && <mesh geometry={rim.rivets} material={wm.chrome} />}
      <mesh geometry={tireGeo.innerSidewall} material={wm.tireSide} castShadow />
      <mesh geometry={tireGeo.tread} material={wm.tread} castShadow />
      <mesh geometry={tireGeo.outerSidewall} material={wm.tireSideOuter} castShadow />
      <mesh geometry={brakeGeo.disc} material={bm.disc} />
      <mesh geometry={brakeGeo.hat} material={bm.hat} />
      <mesh geometry={brakeGeo.caliper} material={bm.caliper} rotation-z={caliperAngle} />
    </group>
  );
}

/** Manifestteki tekerlek konumlarına prosedürel jant + lastik + fren. */
export function ProceduralWheels({ car, fitment }: { car: CarDefinition; fitment: FitmentState }) {
  const discMm = effectiveDiscMm(fitment);
  return (
    <group>
      {WHEEL_IDS.map((id) => {
        const axle = axleOf(id);
        const [x, y, z] = car.manifest.wheels[id].position;
        return (
          <group key={id} position={[x, y, z]}>
            <Wheel
              wheel={fitment.wheels[axle]}
              tire={fitment.tires[axle]}
              brakes={fitment.brakes}
              discMm={discMm}
              outboardSign={x >= 0 ? 1 : -1}
            />
          </group>
        );
      })}
    </group>
  );
}
