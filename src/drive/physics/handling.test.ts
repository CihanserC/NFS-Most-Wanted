import { beforeAll, describe, expect, it } from 'vitest';
import { getCar, listCars } from '../../data/cars';
import { createDefaultBuild } from '../../core/build/build';
import type { DriveInput } from '../../core/drive/drivetrain';
import { buildTrack, getDefaultTrack, queryTrack } from '../../core/drive/track';
import { startGantry } from '../../core/drive/scenery';
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

  it('100 km/s tam direksiyon yarım direksiyondan daha keskin döner (ön lastik doymaz)', () => {
    const yawRate = (steer: number) => {
      const v = launch(id, 100 / 3.6);
      step(v, 2, input({ throttle: 0.35, steer }));
      const s = v.snapshot();
      const yaw = Math.abs(v.chassis.angvel().y);
      const lat = (s.speed * yaw) / G;
      v.dispose();
      return { yaw, lat };
    };
    const half = yawRate(0.5);
    const full = yawRate(1);
    expect(full.yaw).toBeGreaterThan(half.yaw);
    // Arcade hedef: 100 km/s tam direksiyonda ≥ 35°/sn (dönüş yarıçapı ≈ 45 m altı), ≈ 2 g
    expect((full.yaw * 180) / Math.PI).toBeGreaterThan(35);
    expect(full.lat).toBeGreaterThan(1.6);
  });

  it('direksiyon bırakılınca yalpalama hızla söner (düz gider)', () => {
    const v = launch(id, 100 / 3.6);
    step(v, 1.5, input({ throttle: 0.4, steer: 1 }));
    step(v, 0.8, input({ throttle: 0.4 }));
    expect(Math.abs((v.chassis.angvel().y * 180) / Math.PI)).toBeLessThan(3);
    expect(Math.abs(v.snapshot().lateralSpeed)).toBeLessThan(1);
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
    // Başlangıç düzlüğünde, sağ bariyere 10° açıyla 90 km/s: sığ açıyla girip sürtünür
    const s0 = track.samples[track.startIndex + 20]!;
    const a = (10 * Math.PI) / 180;
    const dx = s0.tx * Math.cos(a) - s0.nx * Math.sin(a);
    const dz = s0.tz * Math.cos(a) - s0.nz * Math.sin(a);
    const yaw = Math.atan2(dx, dz);
    v.chassis.setTranslation(
      { x: s0.x - s0.nx * 9, y: v.restHeight + 0.05, z: s0.z - s0.nz * 9 },
      true,
    );
    v.chassis.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    v.chassis.setLinvel({ x: dx * 25, y: 0, z: dz * 25 }, true);
    let maxAway = 0;
    let minForward = Infinity;
    for (let t = 0; t < 3; t += PHYSICS_STEP) {
      v.step(PHYSICS_STEP, input({ throttle: 0.6 }));
      const vel = v.chassis.linvel();
      // Bariyerden uzaklaşma hızı: sol normal yönündeki hız (bariyer sağda)
      maxAway = Math.max(maxAway, vel.x * s0.nx + vel.z * s0.nz);
      minForward = Math.min(minForward, v.snapshot().forwardSpeed);
    }
    expect(v.snapshot().upY).toBeGreaterThan(0.7);
    // Bariyer aracı paralele çevirip hafifçe piste yönlendirir; fırlatmaz
    expect(maxAway).toBeLessThan(4);
    // Eklem yerine takılmaz: hızın büyük kısmı korunur (90 km/s -> en az 72 km/s)
    expect(minForward).toBeGreaterThan(20);
    v.dispose();
  });

  it.each([
    ['sola', 0.6],
    ['sağa', -0.6],
    ['düz (ilk virajda dışarı)', 0],
  ])('tam gaz %s sürünce bariyer aracı pist alanında tutar', (_, steer) => {
    const track = buildTrack();
    const car = getCar('ford_mustang_gt_2013');
    const spec = deriveVehicleSpec(
      createDefaultBuild(car.manifest),
      car.manifest,
      car.parts,
      car.driving,
    );
    const v = VehiclePhysics.create(R, spec, track);
    const limit = track.widthM / 2 + track.config.barrierOffsetM + 1;
    let worst = 0;
    let hint: number | undefined;
    for (let t = 0; t < 25; t += PHYSICS_STEP) {
      v.step(PHYSICS_STEP, input({ throttle: 1, steer: t > 1.5 ? steer : 0 }));
      const [x, , z] = v.snapshot().position;
      const q = queryTrack(track, x, z, hint, 80);
      hint = q.index;
      worst = Math.max(worst, Math.abs(q.offset));
    }
    expect(worst).toBeLessThan(limit);
    v.dispose();
  });

  it('başlangıç kapısının direği katı (içinden geçilmez)', () => {
    const track = buildTrack();
    const car = getCar('vanta_stallion_70');
    const spec = deriveVehicleSpec(
      createDefaultBuild(car.manifest),
      car.manifest,
      car.parts,
      car.driving,
    );
    const v = VehiclePhysics.create(R, spec, track);
    const g = startGantry(track);
    // Direğin 12 m önünden, direğe doğru (pist yönünde) sür
    const px = g.x + Math.cos(g.yaw) * (g.span / 2);
    const pz = g.z - Math.sin(g.yaw) * (g.span / 2);
    const fx = Math.sin(g.yaw);
    const fz = Math.cos(g.yaw);
    v.chassis.setTranslation({ x: px - fx * 12, y: v.restHeight + 0.05, z: pz - fz * 12 }, true);
    v.chassis.setRotation({ x: 0, y: Math.sin(g.yaw / 2), z: 0, w: Math.cos(g.yaw / 2) }, true);
    v.chassis.setLinvel({ x: fx * 15, y: 0, z: fz * 15 }, true);
    for (let t = 0; t < 2; t += PHYSICS_STEP) v.step(PHYSICS_STEP, input({ throttle: 0.5 }));
    const [x, , z] = v.snapshot().position;
    // Direk düzlemini geçmemeli (ileri yöndeki izdüşüm direğin gerisinde kalır)
    expect((x - px) * fx + (z - pz) * fz).toBeLessThan(0);
    v.dispose();
  });
});
