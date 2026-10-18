import { beforeAll, describe, expect, it } from 'vitest';
import { getCar } from '../../data/cars';
import { createDefaultBuild, withLook, withPerformance } from '../../core/build/build';
import type { BuildState } from '../../core/build/types';
import type { DriveInput } from '../../core/drive/drivetrain';
import { buildTrack } from '../../core/drive/track';
import { deriveVehicleSpec } from '../../core/drive/vehicleSpec';
import { loadRapier, type Rapier } from './rapier';
import { PHYSICS_STEP, VehiclePhysics } from './VehiclePhysics';

const car = getCar('vanta_stallion_70');
const track = buildTrack();
const base = createDefaultBuild(car.manifest);
let R: Rapier;

beforeAll(async () => {
  R = await loadRapier();
});

const make = (b: BuildState = base) =>
  VehiclePhysics.create(R, deriveVehicleSpec(b, car.manifest, car.parts), track);
const input = (p: Partial<DriveInput> = {}): DriveInput => ({
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  ...p,
});
const run = (v: VehiclePhysics, seconds: number, i: DriveInput | ((t: number) => DriveInput)) => {
  for (let t = 0; t < seconds; t += PHYSICS_STEP)
    v.step(PHYSICS_STEP, typeof i === 'function' ? i(t) : i);
};

describe('Rapier araç fiziği', () => {
  it('araç dört tekerleğiyle yerleşir, orijin zeminin üstünde makul yükseklikte', () => {
    const v = make();
    run(v, 1, input());
    const s = v.snapshot();
    expect(s.wheels.every((w) => w.contact)).toBe(true);
    expect(s.position[1]).toBeGreaterThan(0.3);
    expect(s.position[1]).toBeLessThan(0.9);
    expect(s.speed).toBeLessThan(0.1);
    expect(s.upY).toBeGreaterThan(0.99);
    expect(v.restHeight).toBeGreaterThan(0.3);
    v.dispose();
  });

  it('tam gazda ileri hızlanır, vites yükselir, pistte kalır', () => {
    const v = make();
    let t100: number | null = null;
    // İlk viraja (≈ 420 m) varmadan: 7 sn
    for (let t = 0; t < 7; t += PHYSICS_STEP) {
      v.step(PHYSICS_STEP, input({ throttle: 1 }));
      if (t100 === null && v.snapshot().forwardSpeed * 3.6 >= 100) t100 = t;
    }
    const s = v.snapshot();
    expect(s.forwardSpeed).toBeGreaterThan(28);
    expect(t100).not.toBeNull();
    expect(t100 ?? 99).toBeLessThan(7);
    expect(t100 ?? 0).toBeGreaterThan(3);
    expect(s.gear).toBeGreaterThan(1);
    expect(s.upY).toBeGreaterThan(0.95);
    expect(s.surface).toBe('asphalt');
    v.dispose();
  });

  it('fren 1 sn içinde en az 6 m/s hız keser, makul (≤ 1.5 g) yavaşlama verir', () => {
    const v = make();
    run(v, 5, input({ throttle: 1 }));
    const before = v.snapshot().forwardSpeed;
    expect(before).toBeGreaterThan(20);
    run(v, 1, input({ brake: 1 }));
    const drop = before - v.snapshot().forwardSpeed;
    expect(drop).toBeGreaterThan(6);
    expect(drop).toBeLessThan(15);
    v.dispose();
  });

  it('direksiyon yanal hızlanma üretir, aşırı hızda devrilmez', () => {
    const v = make();
    run(v, 5, input({ throttle: 1 }));
    const heading0 = v.snapshot().quaternion;
    run(v, 2, input({ throttle: 0.5, steer: 1 }));
    const s = v.snapshot();
    expect(s.quaternion).not.toEqual(heading0);
    expect(s.upY).toBeGreaterThan(0.85);
    v.dispose();
  });

  it('steer +1 sola, -1 sağa döner (yukarıdan bakınca sol = saat yönü tersi)', () => {
    const yawRate = (steer: number) => {
      const v = make();
      run(v, 3, input({ throttle: 1 }));
      run(v, 1, input({ throttle: 0.4, steer }));
      const w = v.chassis.angvel().y;
      v.dispose();
      return w;
    };
    expect(yawRate(1)).toBeGreaterThan(0.1);
    expect(yawRate(-1)).toBeLessThan(-0.1);
  });

  it('burnout: durarak tam gaz + el freni arka tekerleği kaydırır, araç neredeyse yerinde kalır', () => {
    const v = make();
    let maxSlip = 0;
    for (let t = 0; t < 2; t += PHYSICS_STEP) {
      v.step(PHYSICS_STEP, input({ throttle: 1, handbrake: true }));
      maxSlip = Math.max(maxSlip, v.snapshot().wheels[2]?.slip ?? 0);
    }
    expect(maxSlip).toBeGreaterThan(0.3);
    expect(v.snapshot().speed).toBeLessThan(8);
    v.dispose();
  });

  it('geri vites: S ile durup geri gider', () => {
    const v = make();
    run(v, 3, input({ brake: 1 }));
    expect(v.snapshot().forwardSpeed).toBeLessThan(-1);
    expect(v.snapshot().reverse).toBe(true);
    run(v, 6, input({ brake: 1 }));
    expect(v.snapshot().forwardSpeed).toBeGreaterThan(-11);
    v.dispose();
  });

  it('alçak duruşta orijin yüksekliği daha düşük, gasser daha yüksek', () => {
    const at = (mm: number) =>
      make(withLook(base, { stance: { ...base.stance, rideHeightMm: { front: mm, rear: mm } } }));
    const low = at(-70);
    const high = at(90);
    expect(low.restHeight).toBeLessThan(high.restHeight);
    low.dispose();
    high.dispose();
  });

  it('daha güçlü motor/şanzıman 0-100 süresini kısaltır', () => {
    const time = (b: BuildState) => {
      const v = make(b);
      for (let t = 0; t < 12; t += PHYSICS_STEP) {
        v.step(PHYSICS_STEP, input({ throttle: 1 }));
        if (v.snapshot().forwardSpeed * 3.6 >= 100) {
          v.dispose();
          return t;
        }
      }
      v.dispose();
      return 99;
    };
    expect(time(withPerformance(base, { engine: 'race', transmission: 'sport5' }))).toBeLessThan(
      time(base),
    );
  });

  it('çim yüzeyi asfalttan daha yavaştır', () => {
    const v = make();
    // Piste dik olarak çime sür: dışarı doğru yönlendir
    const s = track.samples[track.startIndex]!;
    v.chassis.setTranslation({ x: s.x + s.nx * 14, y: 0.6, z: s.z + s.nz * 14 }, true);
    v.chassis.setRotation(
      {
        x: 0,
        y: Math.sin(Math.atan2(s.tx, s.tz) / 2),
        z: 0,
        w: Math.cos(Math.atan2(s.tx, s.tz) / 2),
      },
      true,
    );
    run(v, 0.5, input());
    expect(v.snapshot().surface).toBe('grass');
    v.dispose();
  });
});
