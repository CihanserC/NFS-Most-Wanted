import { beforeAll, describe, expect, it } from 'vitest';
import { getCar, listCars } from '../../data/cars';
import { createDefaultBuild } from '../../core/build/build';
import type { DriveInput } from '../../core/drive/drivetrain';
import { buildTrack, getDefaultTrack } from '../../core/drive/track';
import { deriveVehicleSpec } from '../../core/drive/vehicleSpec';
import { loadRapier, type Rapier } from './rapier';
import { PHYSICS_STEP, VehiclePhysics } from './VehiclePhysics';

/** Bariyersiz, her yeri asfalt geniş düzlük: yalnızca araç davranışını ölçmek için */
const flat = buildTrack({ ...getDefaultTrack().config, widthM: 6000, barrierOffsetM: 6000 });
const G = 9.81;
let R: Rapier;

beforeAll(async () => {
  R = await loadRapier();
});

const input = (p: Partial<DriveInput> = {}): DriveInput => ({
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  ...p,
});

/** Aracı verilen hızda, düz ileri bakacak şekilde yerleşik başlatır. */
function launch(id: string, speed: number): VehiclePhysics {
  const car = getCar(id);
  const spec = deriveVehicleSpec(
    createDefaultBuild(car.manifest),
    car.manifest,
    car.parts,
    car.driving,
  );
  const v = VehiclePhysics.create(R, spec, flat);
  v.chassis.setTranslation({ x: -150, y: v.restHeight + 0.05, z: 0 }, true);
  const q = v.chassis.rotation();
  const fx = 2 * (q.x * q.z + q.w * q.y);
  const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  v.chassis.setLinvel({ x: fx * speed, y: 0, z: fz * speed }, true);
  for (let i = 0; i < 30; i++) v.step(PHYSICS_STEP, input()); // yerleşme
  return v;
}

const step = (v: VehiclePhysics, seconds: number, i: DriveInput | ((t: number) => DriveInput)) => {
  for (let t = 0; t < seconds; t += PHYSICS_STEP)
    v.step(PHYSICS_STEP, typeof i === 'function' ? i(t) : i);
};

describe.each(listCars().map((c) => c.manifest.id))('sürüş testleri: %s', (id) => {
  it('0–100 km/s makul sürede, düz gider', () => {
    const v = launch(id, 0);
    let t100 = 99;
    for (let t = 0; t < 15; t += PHYSICS_STEP) {
      v.step(PHYSICS_STEP, input({ throttle: 1 }));
      if (v.snapshot().forwardSpeed * 3.6 >= 100) {
        t100 = t;
        break;
      }
    }
    expect(t100).toBeGreaterThan(2.5);
    expect(t100).toBeLessThan(10);
    expect(Math.abs(v.snapshot().lateralSpeed)).toBeLessThan(1);
    v.dispose();
  });

  it('100→0 km/s fren mesafesi 1.5 g sınırının altında ve düz', () => {
    const v = launch(id, 100 / 3.6);
    const s0 = v.snapshot().position;
    // Duruşa kadar fren (durunca geri vites devreye girer, o yüzden duruşta bırak)
    let t = 0;
    while (v.snapshot().forwardSpeed > 0.3 && t < 8) {
      v.step(PHYSICS_STEP, input({ brake: 1 }));
      t += PHYSICS_STEP;
    }
    const s = v.snapshot();
    const dist = Math.hypot(s.position[0] - s0[0], s.position[2] - s0[2]);
    expect(t).toBeLessThan(8);
    expect(dist).toBeGreaterThan((100 / 3.6) ** 2 / (2 * 1.5 * G));
    expect(dist).toBeLessThan(80);
    expect(Math.abs(s.lateralSpeed)).toBeLessThan(1.5);
    v.dispose();
  });

  it('skidpad: yanal ivme 0.7–1.6 g ve araç devrilmez', () => {
    const v = launch(id, 20);
    let maxLat = 0;
    for (let t = 0; t < 8; t += PHYSICS_STEP) {
      v.step(PHYSICS_STEP, input({ throttle: t < 4 ? 0.6 : 0.3, steer: 0.5 }));
      if (t > 3)
        maxLat = Math.max(maxLat, (v.snapshot().speed * Math.abs(v.chassis.angvel().y)) / G);
    }
    expect(v.snapshot().upY).toBeGreaterThan(0.9);
    expect(maxLat).toBeGreaterThan(0.7);
    expect(maxLat).toBeLessThan(1.6);
    v.dispose();
  });

  it('slalom: hızlı sol-sağ geçişte devrilmez, kontrol kaybolmaz', () => {
    const v = launch(id, 25);
    step(v, 8, (t) => input({ throttle: 0.4, steer: Math.sin(t * 2.5) }));
    expect(v.snapshot().upY).toBeGreaterThan(0.85);
    expect(v.snapshot().speed).toBeGreaterThan(8);
    v.dispose();
  });

  it('el freniyle yüksek hızda dönüş kaymaya geçer (drift) ama devrilmez', () => {
    const v = launch(id, 30);
    step(v, 0.8, input({ steer: 0.7, handbrake: true }));
    const s = v.snapshot();
    expect(Math.abs(s.lateralSpeed)).toBeGreaterThan(2);
    expect(s.upY).toBeGreaterThan(0.85);
    v.dispose();
  });

  it('tam hızda ani tam direksiyon devirmez', () => {
    const v = launch(id, 45);
    step(v, 3, input({ steer: 1 }));
    expect(v.snapshot().upY).toBeGreaterThan(0.6);
    v.dispose();
  });
});

describe('bariyer çarpışması', () => {
  it('bariyere yandan sürtünce geri sekmez, devrilmez', () => {
    const track = buildTrack();
    const car = getCar('vanta_stallion_70');
    const spec = deriveVehicleSpec(
      createDefaultBuild(car.manifest),
      car.manifest,
      car.parts,
      car.driving,
    );
    const v = VehiclePhysics.create(R, spec, track);
    // Düzlükte tam gaz + sola tam direksiyon: bariyere girer
    let hit = false;
    let maxBounce = 0;
    for (let t = 0; t < 12; t += PHYSICS_STEP) {
      v.step(PHYSICS_STEP, input({ throttle: 1, steer: t > 2 ? 0.35 : 0 }));
      const s = v.snapshot();
      if (s.speed > 8 && Math.abs(s.lateralSpeed) > 0.5) hit = true;
      if (hit) maxBounce = Math.max(maxBounce, -s.forwardSpeed);
    }
    expect(v.snapshot().upY).toBeGreaterThan(0.7);
    expect(maxBounce).toBeLessThan(1);
    v.dispose();
  });
});
