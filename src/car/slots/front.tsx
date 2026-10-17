import { RoundedBox } from '@react-three/drei';
import { paintFor } from '../materials/carMaterials';
import { useCarMaterials } from '../materials/useCarMaterials';
import { Mirrored, type SlotProps } from './common';

/** Ön bölge placeholder ölçüleri (m). z değerleri burun yüzeyine göredir. */
const LAYOUT = {
  bumper: { y: 0.42, width: 1.78, height: 0.11, depth: 0.14, offsetZ: 0.03, radius: 0.04 },
  bumperWrap: { x: 0.84, size: [0.12, 0.11, 0.3] as const, offsetZ: -0.1, yaw: 0.35 },
  valance: { y: 0.4, width: 1.66, height: 0.08, depth: 0.06, offsetZ: 0.005 },
  lip: { y: 0.33, width: 1.7, thickness: 0.025, depth: 0.12, offsetZ: 0.02 },
  grille: { y: 0.61, width: 1.5, height: 0.22, depth: 0.04, offsetZ: 0.005, frame: 0.018 },
  grilleBars: { stock: 3, billet: 6, meshColumns: 16, meshRows: 5, bar: 0.012, billetBar: 0.022 },
  headlight: { x: 0.62, y: 0.62, offsetZ: 0.03, radius: 0.08, bezelTube: 0.012, haloRadius: 0.06 },
  hiddenCover: { width: 0.27, height: 0.19, depth: 0.02, slats: 4 },
  chin: { y: 0.31, width: 1.5, thickness: 0.03, depth: 0.14, offsetZ: -0.02, pitch: -0.25 },
  splitter: { y: 0.29, width: 1.72, thickness: 0.012, depth: 0.2, offsetZ: 0.02 },
} as const;

export function FrontBumper({ option, car }: SlotProps) {
  const m = useCarMaterials();
  const z0 = car.body.halfLength;
  const L = LAYOUT;
  const valance = (
    <mesh position={[0, L.valance.y, z0 + L.valance.offsetZ]} material={paintFor(m, 'bumpers')}>
      <boxGeometry args={[L.valance.width, L.valance.height, L.valance.depth]} />
    </mesh>
  );
  switch (option) {
    case 'stock_chrome':
      return (
        <group>
          <RoundedBox
            args={[L.bumper.width, L.bumper.height, L.bumper.depth]}
            radius={L.bumper.radius}
            position={[0, L.bumper.y, z0 + L.bumper.offsetZ]}
            material={m.chrome}
            castShadow
          />
          <Mirrored>
            <RoundedBox
              args={[...L.bumperWrap.size]}
              radius={L.bumper.radius}
              position={[L.bumperWrap.x, L.bumper.y, z0 + L.bumperWrap.offsetZ]}
              rotation-y={L.bumperWrap.yaw}
              material={m.chrome}
            />
          </Mirrored>
        </group>
      );
    case 'chrome_delete':
      return valance;
    case 'pro_touring_lip':
      return (
        <group>
          {valance}
          <mesh position={[0, L.lip.y, z0 + L.lip.offsetZ]} material={m.blackTrim}>
            <boxGeometry args={[L.lip.width, L.lip.thickness, L.lip.depth]} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

export function Grille({ option, car }: SlotProps) {
  const m = useCarMaterials();
  const g = LAYOUT.grille;
  const bars = LAYOUT.grilleBars;
  const z = car.body.halfLength + g.offsetZ + g.depth / 2;

  const horizontal = (count: number, thickness: number, material = m.aluminum) =>
    Array.from({ length: count }, (_, i) => (
      <mesh
        key={`h${i}`}
        position={[0, g.y - g.height / 2 + (g.height * (i + 1)) / (count + 1), z]}
        material={material}
      >
        <boxGeometry args={[g.width - g.frame * 2, thickness, thickness]} />
      </mesh>
    ));
  const vertical = (count: number, thickness: number) =>
    Array.from({ length: count }, (_, i) => (
      <mesh
        key={`v${i}`}
        position={[-g.width / 2 + (g.width * (i + 1)) / (count + 1), g.y, z]}
        material={m.aluminum}
      >
        <boxGeometry args={[thickness, g.height - g.frame * 2, thickness]} />
      </mesh>
    ));

  return (
    <group>
      <mesh position={[0, g.y, car.body.halfLength + g.offsetZ]} material={m.blackTrim}>
        <boxGeometry args={[g.width, g.height, g.depth]} />
      </mesh>
      {/* Çerçeve */}
      {[1, -1].map((s) => (
        <mesh
          key={`fy${s}`}
          position={[0, g.y + (s * (g.height - g.frame)) / 2, z]}
          material={m.chrome}
        >
          <boxGeometry args={[g.width, g.frame, g.frame]} />
        </mesh>
      ))}
      {[1, -1].map((s) => (
        <mesh key={`fx${s}`} position={[(s * (g.width - g.frame)) / 2, g.y, z]} material={m.chrome}>
          <boxGeometry args={[g.frame, g.height, g.frame]} />
        </mesh>
      ))}
      {option === 'stock' && horizontal(bars.stock, bars.bar, m.blackTrim)}
      {option === 'mesh' && (
        <>
          {horizontal(bars.meshRows, bars.bar)}
          {vertical(bars.meshColumns, bars.bar)}
        </>
      )}
      {option === 'billet' && horizontal(bars.billet, bars.billetBar, m.chrome)}
    </group>
  );
}

export function Headlights({ option, car }: SlotProps) {
  const m = useCarMaterials();
  const h = LAYOUT.headlight;
  const z = car.body.halfLength + h.offsetZ;
  const FACE_FORWARD = Math.PI / 2;

  if (option === 'hidden') {
    const c = LAYOUT.hiddenCover;
    return (
      <Mirrored>
        <mesh position={[h.x, h.y, z]} material={m.blackTrim}>
          <boxGeometry args={[c.width, c.height, c.depth]} />
        </mesh>
        {Array.from({ length: c.slats }, (_, i) => (
          <mesh
            key={i}
            position={[
              h.x,
              h.y - c.height / 2 + (c.height * (i + 1)) / (c.slats + 1),
              z + c.depth / 2,
            ]}
            material={m.aluminum}
          >
            <boxGeometry args={[c.width * 0.92, 0.008, 0.006]} />
          </mesh>
        ))}
      </Mirrored>
    );
  }

  return (
    <Mirrored>
      <group position={[h.x, h.y, z]}>
        <mesh material={m.chrome}>
          <torusGeometry args={[h.radius, h.bezelTube, 10, 32]} />
        </mesh>
        <mesh rotation-x={FACE_FORWARD} material={m.headlightLens}>
          <cylinderGeometry args={[h.radius, h.radius, 0.02, 32]} />
        </mesh>
        {option === 'led_halo' && (
          <mesh position-z={0.012} material={m.ledHalo}>
            <torusGeometry args={[h.haloRadius, 0.006, 8, 40]} />
          </mesh>
        )}
      </group>
    </Mirrored>
  );
}

export function ChinSpoiler({ option, car }: SlotProps) {
  const m = useCarMaterials();
  const z0 = car.body.halfLength;
  if (option === 'classic') {
    const c = LAYOUT.chin;
    return (
      <mesh
        position={[0, c.y, z0 + c.offsetZ]}
        rotation-x={c.pitch}
        material={paintFor(m, 'bumpers')}
      >
        <boxGeometry args={[c.width, c.thickness, c.depth]} />
      </mesh>
    );
  }
  if (option === 'carbon_splitter') {
    const s = LAYOUT.splitter;
    return (
      <mesh position={[0, s.y, z0 + s.offsetZ]} material={m.carbon}>
        <boxGeometry args={[s.width, s.thickness, s.depth]} />
      </mesh>
    );
  }
  return null;
}
