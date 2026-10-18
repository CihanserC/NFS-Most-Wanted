import { useRef, type RefObject } from 'react';
import { Quaternion, Vector3, type Group } from 'three';
import { exhaustTails } from '../../car/slots/exhaustTails';
import type { CarDefinition } from '../../data/cars';
import type { VehicleSnapshot } from '../physics/VehiclePhysics';
import type { ParticlePool } from './particles';
import { ParticleSystem } from './ParticleSystem';
import { SkidMarks } from './SkidMarks';

const SMOKE_CAPACITY = 700;
const FLAME_CAPACITY = 160;
/** Lastik dumanı: kayma 1.0'da saniyedeki parçacık sayısı */
const SMOKE_RATE = 95;
const DUST_RATE = 28;
const FLAME_PER_TAIL = 5;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const tmp = new Vector3();
const dir = new Vector3();
const quat = new Quaternion();

/** İz, lastik dumanı, çim tozu ve egzoz alevi. Aracın anlık durumunu snapshot'tan okur. */
export function VehicleEffects({
  snapshotRef,
  rigRef,
  car,
  parts,
  paused,
}: {
  snapshotRef: RefObject<VehicleSnapshot | null>;
  /** Aracın görsel kökü (zemin hizalı); egzoz uçlarını dünyaya çevirmek için */
  rigRef: RefObject<Group | null>;
  car: CarDefinition;
  parts: Record<string, string>;
  paused: boolean;
}) {
  const smoke = useRef<ParticlePool | null>(null);
  const flame = useRef<ParticlePool | null>(null);

  const emitSmoke = (pool: ParticlePool, dt: number) => {
    const snap = snapshotRef.current;
    if (!snap) return;
    snap.wheels.forEach((w, i) => {
      if (!w.contact) return;
      const rear = i >= 2;
      const grass = w.surface === 'grass' && snap.speed > 5;
      const slip = w.slip * (rear ? 1 : 0.7);
      const rate = grass
        ? DUST_RATE * Math.min(1, snap.speed / 20)
        : slip > 0.25
          ? SMOKE_RATE * slip
          : 0;
      let n = rate * dt;
      while (n > 0 && Math.random() < Math.min(1, n)) {
        n -= 1;
        pool.emit({
          x: w.contactX + rand(-0.15, 0.15),
          y: 0.12,
          z: w.contactZ + rand(-0.15, 0.15),
          vx: rand(-0.6, 0.6),
          vy: rand(0.5, 1.4),
          vz: rand(-0.6, 0.6),
          life: grass ? rand(0.7, 1.2) : rand(1.1, 2),
          size0: grass ? 1.2 : 1.6,
          size1: grass ? 3.2 : 4.6,
          alpha: grass ? 0.26 : 0.36 * Math.min(1, slip + 0.2),
          r: grass ? 0.5 : 0.86,
          g: grass ? 0.42 : 0.86,
          b: grass ? 0.3 : 0.88,
        });
      }
    });
  };

  const emitFlames = (pool: ParticlePool) => {
    const snap = snapshotRef.current;
    const group = rigRef.current;
    if (!snap?.liftOff || !group) return;
    const tails = exhaustTails(parts.exhaust ?? 'rear_dual', car);
    group.getWorldQuaternion(quat);
    for (const tail of tails) {
      tmp.set(...tail.at);
      group.localToWorld(tmp);
      dir.set(...tail.direction).applyQuaternion(quat);
      for (let k = 0; k < FLAME_PER_TAIL; k++)
        pool.emit({
          x: tmp.x,
          y: tmp.y,
          z: tmp.z,
          vx: dir.x * rand(5, 9) + rand(-0.4, 0.4),
          vy: dir.y * rand(5, 9) + rand(-0.2, 0.4),
          vz: dir.z * rand(5, 9) + rand(-0.4, 0.4),
          life: rand(0.08, 0.2),
          size0: 0.5,
          size1: 1.1,
          alpha: 0.95,
          r: 1,
          g: rand(0.35, 0.6),
          b: 0.1,
        });
    }
  };

  return (
    <>
      <SkidMarks snapshotRef={snapshotRef} />
      <ParticleSystem
        capacity={SMOKE_CAPACITY}
        additive={false}
        poolRef={smoke}
        onFrame={emitSmoke}
        paused={paused}
      />
      <ParticleSystem
        capacity={FLAME_CAPACITY}
        additive
        poolRef={flame}
        onFrame={emitFlames}
        paused={paused}
      />
    </>
  );
}
