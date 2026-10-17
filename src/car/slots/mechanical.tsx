import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import type { Vec3 } from '../../core/math/tuples';
import { useCarMaterials } from '../materials/useCarMaterials';
import { Bar, type SlotProps } from './common';
import { deckPose } from './pose';

/** Egzoz, motor ve iç mekan placeholder ölçüleri (m). */
const LAYOUT = {
  exhaust: {
    y: 0.22,
    pipeRadius: 0.03,
    startZ: -1.7,
    tailOffset: 0.02,
    dualX: [0.55],
    quadX: [0.45, 0.62],
    side: { y: 0.28, out: 0.05, zFront: 0.95, zRear: -0.85 },
  },
  tip: { length: 0.12, radius: 0.042, ovalScale: [1.4, 0.8] as const, turnDownAngle: Math.PI / 4 },
  engine: {
    bay: { width: 1.3, height: 0.5, depth: 1.0 },
    block: { y: 0.62, size: [0.6, 0.25, 0.6] as const },
    covers: { x: 0.22, y: 0.78, size: [0.12, 0.08, 0.6] as const, roll: 0.4 },
    intake: { y: 0.8, size: [0.3, 0.08, 0.45] as const },
    smallCleaner: { y: 0.88, radius: 0.16, height: 0.06 },
    bigCleaner: { y: 0.9, radius: 0.22, height: 0.08 },
    blower: { y: 0.97, size: [0.28, 0.25, 0.5] as const, hat: [0.3, 0.1, 0.3] as const },
  },
  interior: {
    seatX: 0.38,
    seat: { y: 0.55, z: -0.25, size: [0.45, 0.12, 0.45] as const },
    back: { y: 0.85, z: -0.5, size: [0.45, 0.55, 0.1] as const, recline: 0.2 },
    bench: { y: 0.55, z: -1.1, size: [1.3, 0.12, 0.4] as const },
    benchBack: { y: 0.8, z: -1.3, size: [1.3, 0.45, 0.1] as const },
    dash: { y: 0.88, z: 0.42, size: [1.5, 0.18, 0.3] as const },
    wheel: { y: 0.95, z: 0.22, radius: 0.18, tilt: -0.4 },
  },
  cage: {
    radius: 0.022,
    hoopZ: -0.6,
    hoopX: 0.55,
    top: 1.2,
    frontZ: 0.15,
    frontTop: 1.15,
    footY: 0.45,
    rearZ: -1.4,
  },
} as const;

const UP = new Vector3(0, 1, 0);
const FACE_FORWARD = Math.PI / 2;

type Pipe = { from: Vec3; to: Vec3; visible: boolean };

function exhaustPipes(option: string, sideX: number, halfLength: number): Pipe[] {
  const e = LAYOUT.exhaust;
  const tailZ = -halfLength - e.tailOffset;
  if (option === 'side_pipes') {
    const x = sideX + e.side.out;
    return [1, -1].map((s) => ({
      from: [s * x, e.side.y, e.side.zFront],
      to: [s * x, e.side.y, e.side.zRear],
      visible: true,
    }));
  }
  const xs = option === 'quad' ? e.quadX : e.dualX;
  return xs.flatMap((x) =>
    [1, -1].map((s) => ({
      from: [s * x, e.y, e.startZ] as Vec3,
      to: [s * x, e.y, tailZ] as Vec3,
      visible: false,
    })),
  );
}

function Tip({ at, direction, style }: { at: Vec3; direction: Vec3; style: string }) {
  const m = useCarMaterials();
  const t = LAYOUT.tip;
  const quaternion = useMemo(() => {
    const dir = new Vector3(...direction).normalize();
    if (style === 'turn_down')
      dir.applyAxisAngle(new Vector3(-dir.z, 0, dir.x).normalize(), -t.turnDownAngle);
    return new Quaternion().setFromUnitVectors(UP, dir);
  }, [direction, style, t.turnDownAngle]);

  const material = style === 'black_ceramic' ? m.blackTrim : m.chrome;
  const radius = style === 'turn_down' ? t.radius * 0.85 : t.radius;
  const scale: Vec3 = style === 'oval' ? [t.ovalScale[0], 1, t.ovalScale[1]] : [1, 1, 1];
  return (
    <group position={at} quaternion={quaternion}>
      <group position-y={t.length / 2} scale={scale}>
        <mesh material={material} castShadow>
          <cylinderGeometry args={[radius, radius, t.length, 24, 1, true]} />
        </mesh>
        <mesh position-y={t.length / 2 - 0.01} material={m.underbody}>
          <cylinderGeometry args={[radius * 0.85, radius * 0.85, 0.005, 24]} />
        </mesh>
      </group>
    </group>
  );
}

/** Egzoz boruları + uçları (exhaust_tips slotunu da burada çizer). */
export function Exhaust({ option, parts, car }: SlotProps) {
  const m = useCarMaterials();
  const tipStyle = parts.exhaust_tips ?? 'round_chrome';
  const pipes = exhaustPipes(option, car.body.sideX(0, LAYOUT.exhaust.side.y), car.body.halfLength);
  return (
    <group>
      {pipes.map((p, i) => {
        const dir: Vec3 = [p.to[0] - p.from[0], p.to[1] - p.from[1], p.to[2] - p.from[2]];
        return (
          <group key={i}>
            <Bar
              from={p.from}
              to={p.to}
              radius={LAYOUT.exhaust.pipeRadius}
              material={p.visible ? m.chrome : m.blackTrim}
            />
            <Tip at={p.to} direction={dir} style={tipStyle} />
          </group>
        );
      })}
    </group>
  );
}

/** Ayrı geometri üretmez; uçlar Exhaust bileşeni tarafından çizilir. */
export function ExhaustTips() {
  return null;
}

/** Motor sadece kaput kesikken görünür; aksi halde kapalı kaputun altında kalır. */
export function Engine({ option, parts, car }: SlotProps) {
  const m = useCarMaterials();
  if (parts.hood !== 'blower_cutout') return null;
  const e = LAYOUT.engine;
  const zc = car.body.profile.blowerCutout.zCenter;
  const deck = deckPose(car, zc).y;
  const coverMat = option === 'chrome_covers' ? m.chrome : m.engineAccent;

  return (
    <group position-z={zc}>
      <mesh position-y={deck - e.bay.height / 2} material={m.cavity}>
        <boxGeometry args={[e.bay.width, e.bay.height, e.bay.depth]} />
      </mesh>
      <mesh position-y={e.block.y} material={m.engineBlock}>
        <boxGeometry args={[...e.block.size]} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh
          key={s}
          position={[s * e.covers.x, e.covers.y, 0]}
          rotation-z={-s * e.covers.roll}
          material={coverMat}
        >
          <boxGeometry args={[...e.covers.size]} />
        </mesh>
      ))}
      <mesh position-y={e.intake.y} material={m.aluminum}>
        <boxGeometry args={[...e.intake.size]} />
      </mesh>
      {(option === 'stock_v8' || option === 'chrome_covers') && (
        <mesh
          position-y={e.smallCleaner.y}
          material={option === 'chrome_covers' ? m.chrome : m.blackTrim}
        >
          <cylinderGeometry
            args={[e.smallCleaner.radius, e.smallCleaner.radius, e.smallCleaner.height, 32]}
          />
        </mesh>
      )}
      {option === 'air_cleaner' && (
        <mesh position-y={e.bigCleaner.y} material={m.chrome}>
          <cylinderGeometry
            args={[e.bigCleaner.radius, e.bigCleaner.radius, e.bigCleaner.height, 40]}
          />
        </mesh>
      )}
      {option === 'blower_v8' && (
        <group position-y={e.blower.y}>
          <mesh material={m.aluminum} castShadow>
            <boxGeometry args={[...e.blower.size]} />
          </mesh>
          <mesh position-y={e.blower.size[1] / 2 + e.blower.hat[1] / 2} material={m.blackTrim}>
            <boxGeometry args={[...e.blower.hat]} />
          </mesh>
          <mesh
            position-z={e.blower.size[2] / 2 + 0.02}
            rotation-x={FACE_FORWARD}
            material={m.chrome}
          >
            <cylinderGeometry args={[0.08, 0.08, 0.04, 24]} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function Interior({ option, car }: SlotProps) {
  const m = useCarMaterials();
  const i = LAYOUT.interior;
  const open = car.body.profile.cabinOpening;
  const tubDepth = car.body.profile.cabin.baseY - open.floorY;
  const c = LAYOUT.cage;

  return (
    <group>
      <mesh
        position={[0, open.floorY + tubDepth / 2, (open.zStart + open.zEnd) / 2]}
        material={m.cavity}
      >
        <boxGeometry args={[open.halfWidth * 2, tubDepth, open.zEnd - open.zStart]} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} position-x={s * i.seatX}>
          <mesh position={[0, i.seat.y, i.seat.z]} material={m.interior}>
            <boxGeometry args={[...i.seat.size]} />
          </mesh>
          <mesh
            position={[0, i.back.y, i.back.z]}
            rotation-x={i.back.recline}
            material={m.interior}
          >
            <boxGeometry args={[...i.back.size]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, i.bench.y, i.bench.z]} material={m.interior}>
        <boxGeometry args={[...i.bench.size]} />
      </mesh>
      <mesh position={[0, i.benchBack.y, i.benchBack.z]} material={m.interior}>
        <boxGeometry args={[...i.benchBack.size]} />
      </mesh>
      <mesh position={[0, i.dash.y, i.dash.z]} material={m.interior}>
        <boxGeometry args={[...i.dash.size]} />
      </mesh>
      <mesh
        position={[i.seatX, i.wheel.y, i.wheel.z]}
        rotation-x={i.wheel.tilt}
        material={m.blackTrim}
      >
        <torusGeometry args={[i.wheel.radius, 0.015, 8, 32]} />
      </mesh>

      {option === 'roll_cage' &&
        [1, -1].map((s) => (
          <group key={s}>
            <Bar
              from={[s * c.hoopX, c.footY, c.hoopZ]}
              to={[s * c.hoopX, c.top, c.hoopZ]}
              radius={c.radius}
              material={m.cage}
            />
            <Bar
              from={[s * c.hoopX, c.top, c.hoopZ]}
              to={[s * c.hoopX, c.frontTop, c.frontZ]}
              radius={c.radius}
              material={m.cage}
            />
            <Bar
              from={[s * c.hoopX, c.frontTop, c.frontZ]}
              to={[s * c.hoopX, c.footY + 0.2, i.dash.z]}
              radius={c.radius}
              material={m.cage}
            />
            <Bar
              from={[s * c.hoopX, c.top, c.hoopZ]}
              to={[s * c.hoopX * 0.9, c.footY + 0.15, c.rearZ]}
              radius={c.radius}
              material={m.cage}
            />
          </group>
        ))}
      {option === 'roll_cage' && (
        <>
          <Bar
            from={[c.hoopX, c.top, c.hoopZ]}
            to={[-c.hoopX, c.top, c.hoopZ]}
            radius={c.radius}
            material={m.cage}
          />
          <Bar
            from={[c.hoopX, c.footY, c.hoopZ]}
            to={[-c.hoopX, c.top, c.hoopZ]}
            radius={c.radius}
            material={m.cage}
          />
        </>
      )}
    </group>
  );
}
