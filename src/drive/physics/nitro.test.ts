import { beforeAll, describe, expect, it } from 'vitest';
import { createDefaultBuild } from '../../core/build/build';
import type { DriveInput } from '../../core/drive/drivetrain';
import { buildTrack, getDefaultTrack } from '../../core/drive/track';
import { deriveVehicleSpec } from '../../core/drive/vehicleSpec';
import { normalizePerformance, type NitroLevel } from '../../core/performance/performance';
import { getCar } from '../../data/cars';
import { loadRapier, type Rapier } from './rapier';
import { PHYSICS_STEP, VehiclePhysics } from './VehiclePhysics';

const flat = buildTrack({ ...getDefaultTrack().config, widthM: 6000, barrierOffsetM: 6000 });
let R: Rapier;
beforeAll(async () => {
  R = await loadRapier();
});

function create(nitro: NitroLevel): VehiclePhysics {
  const car = getCar('ford_mustang_gt_2013');
  const build = createDefaultBuild(car.manifest);
  build.performance = normalizePerformance({ ...build.performance, nitro });
  const spec = deriveVehicleSpec(build, car.manifest, car.parts, car.driving);
  const v = VehiclePhysics.create(R, spec, flat);
  v.chassis.setTranslation({ x: -150, y: v.restHeight + 0.05, z: 0 }, true);
  return v;
}

const input = (nitro: boolean): DriveInput => ({
  throttle: 1,
  brake: 0,
  steer: 0,
  handbrake: false,
  nitro,
});

/** Tam gaz + nitro basılı, verilen sürede ulaşılan hız (km/s) */
function speedAfter(level: NitroLevel, seconds: number): number {
  const v = create(level);
  for (let t = 0; t < seconds; t += PHYSICS_STEP) v.step(PHYSICS_STEP, input(true));
  const kmh = v.snapshot().forwardSpeed * 3.6;
  v.dispose();
  return kmh;
}

describe('nitro', () => {
  it('kademe arttıkça aynı sürede daha hızlı; takılı değilse etkisiz', () => {
    const none = speedAfter('none', 3);
    const s1 = speedAfter('stage1', 3);
    const s3 = speedAfter('stage3', 3);
    expect(s1).toBeGreaterThan(none + 15);
    expect(s3).toBeGreaterThan(s1 + 8);
  });

  it('tüp kullanılırken boşalır, bitince itiş durur; bırakınca dolar', () => {
    const v = create('stage1');
    for (let t = 0; t < 2; t += PHYSICS_STEP) v.step(PHYSICS_STEP, input(true));
    const s = v.snapshot();
    expect(s.nitroActive).toBe(true);
    expect(s.nitro).toBeLessThan(0.55);
    for (let t = 0; t < 3; t += PHYSICS_STEP) v.step(PHYSICS_STEP, input(true));
    expect(v.snapshot().nitro).toBe(0);
    expect(v.snapshot().nitroActive).toBe(false);
    for (let t = 0; t < 4; t += PHYSICS_STEP) v.step(PHYSICS_STEP, input(false));
    expect(v.snapshot().nitro).toBeGreaterThan(0.2);
    v.dispose();
  });

  it('eski kayıtlarda nitro alanı yoksa "none" olur', () => {
    expect(normalizePerformance({ engine: 'race' }).nitro).toBe('none');
  });
});
