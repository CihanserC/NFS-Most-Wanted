import { RoundedBox } from '@react-three/drei';
import { paintFor } from '../materials/carMaterials';
import { useCarMaterials } from '../materials/useCarMaterials';
import { Mirrored, type SlotProps } from './common';

/** Arka bölge placeholder ölçüleri (m). z değerleri arka panel yüzeyine göredir (-z yönü dışarı). */
const LAYOUT = {
  bumper: { y: 0.43, width: 1.76, height: 0.1, depth: 0.13, offsetZ: 0.03, radius: 0.04 },
  valance: { y: 0.42, width: 1.6, height: 0.08, depth: 0.05, offsetZ: 0.005 },
  diffuser: { y: 0.3, width: 1.4, height: 0.1, depth: 0.25, offsetZ: -0.06, fins: 7, fin: 0.012 },
  taillight: { x: 0.42, y: 0.68, width: 0.55, height: 0.1, depth: 0.02, bezel: 0.015 },
  ledStrip: { y: 0.7, width: 1.5, height: 0.035, panelHeight: 0.12 },
  fuelCap: { y: 0.56, stockRadius: 0.055, racingRadius: 0.075, thickness: 0.015 },
} as const;

const FACE_REAR = Math.PI / 2;

export function RearBumper({ option, car }: SlotProps) {
  const m = useCarMaterials();
  const z0 = -car.body.halfLength;
  const L = LAYOUT;
  switch (option) {
    case 'stock_chrome':
      return (
        <RoundedBox
          args={[L.bumper.width, L.bumper.height, L.bumper.depth]}
          radius={L.bumper.radius}
          position={[0, L.bumper.y, z0 - L.bumper.offsetZ]}
          material={m.chrome}
          castShadow
        />
      );
    case 'bumper_delete':
      return (
        <mesh position={[0, L.valance.y, z0 - L.valance.offsetZ]} material={paintFor(m, 'bumpers')}>
          <boxGeometry args={[L.valance.width, L.valance.height, L.valance.depth]} />
        </mesh>
      );
    case 'diffuser': {
      const d = L.diffuser;
      const zc = z0 - d.offsetZ;
      return (
        <group>
          <mesh position={[0, d.y + d.height / 2, zc]} material={m.blackTrim}>
            <boxGeometry args={[d.width, 0.02, d.depth]} />
          </mesh>
          {Array.from({ length: d.fins }, (_, i) => (
            <mesh
              key={i}
              position={[-d.width / 2 + (d.width * (i + 1)) / (d.fins + 1), d.y, zc]}
              material={m.blackTrim}
            >
              <boxGeometry args={[d.fin, d.height, d.depth]} />
            </mesh>
          ))}
        </group>
      );
    }
    default:
      return null;
  }
}

export function Taillights({ option, car }: SlotProps) {
  const m = useCarMaterials();
  const z0 = -car.body.halfLength;
  const t = LAYOUT.taillight;

  if (option === 'led_strip') {
    const s = LAYOUT.ledStrip;
    return (
      <group>
        <mesh position={[0, s.y, z0 - 0.006]} material={m.blackTrim}>
          <boxGeometry args={[s.width + 0.1, s.panelHeight, 0.012]} />
        </mesh>
        <mesh position={[0, s.y, z0 - 0.014]} material={m.ledStrip}>
          <boxGeometry args={[s.width, s.height, 0.008]} />
        </mesh>
      </group>
    );
  }

  const lens = option === 'smoked' ? m.tailSmoked : m.tailLens;
  return (
    <Mirrored>
      <mesh position={[t.x, t.y, z0 - t.bezel / 2]} material={m.chrome}>
        <boxGeometry args={[t.width + 0.03, t.height + 0.03, t.bezel]} />
      </mesh>
      <mesh position={[t.x, t.y, z0 - t.bezel - t.depth / 2]} material={lens}>
        <boxGeometry args={[t.width, t.height, t.depth]} />
      </mesh>
    </Mirrored>
  );
}

export function FuelCap({ option, car }: SlotProps) {
  const m = useCarMaterials();
  const f = LAYOUT.fuelCap;
  const z = -car.body.halfLength - f.thickness / 2;
  if (option === 'racing') {
    return (
      <group position={[0, f.y, z]}>
        <mesh rotation-x={FACE_REAR} material={m.chrome}>
          <cylinderGeometry args={[f.racingRadius, f.racingRadius, f.thickness, 32]} />
        </mesh>
        <mesh position-z={-f.thickness / 2} material={m.aluminum}>
          <torusGeometry args={[f.racingRadius * 0.7, 0.006, 8, 32]} />
        </mesh>
        <mesh position={[f.racingRadius * 0.6, 0, -f.thickness]} material={m.blackTrim}>
          <boxGeometry args={[0.05, 0.02, 0.01]} />
        </mesh>
      </group>
    );
  }
  return (
    <mesh position={[0, f.y, z]} rotation-x={FACE_REAR} material={m.chrome}>
      <cylinderGeometry args={[f.stockRadius, f.stockRadius, f.thickness, 32]} />
    </mesh>
  );
}
