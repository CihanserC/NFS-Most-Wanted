import { beforeAll, describe, expect, it } from 'vitest';
import { getCar } from '../../data/cars';
import { createDefaultBuild, withPerformance } from '../../core/build/build';
import type { BuildState } from '../../core/build/types';
import type { DriveInput } from '../../core/drive/drivetrain';
import { initialLap, updateLap } from '../../core/drive/lap';
import { buildTrack, type TrackSample } from '../../core/drive/track';
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

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Pist çizgisini izleyen basit otopilot (testte aracın turu tamamlayabildiğini doğrular). */
function autopilot(v: VehiclePhysics, lateralG = 7): DriveInput {
  const s = v.snapshot();
  const n = track.samples.length;
  const spacing = track.length / n;
  const [qx, qy, qz, qw] = s.quaternion;
  const fx = 2 * (qx * qz + qw * qy);
  const fz = 1 - 2 * (qx * qx + qy * qy);
  const heading = Math.atan2(fx, fz);
  const ahead = Math.round((5 + s.speed * 0.5) / spacing);
  const t = track.samples[(s.trackIndex + ahead) % n] as TrackSample;
  const desired = Math.atan2(t.x - s.position[0], t.z - s.position[2]);
  const steer = Math.max(-1, Math.min(1, wrap(desired - heading) * 2.2));
  // Önündeki en dar virajdan hedef hız; bakış mesafesi frenleme mesafesiyle büyür
  let rmin = Infinity;
  const lookahead = Math.max(70, 20 + (s.speed * s.speed) / 12);
  for (let k = 0; k < Math.round(lookahead / spacing); k++)
    rmin = Math.min(rmin, (track.samples[(s.trackIndex + k) % n] as TrackSample).radius);
  const target = Math.max(11, Math.min(85, Math.sqrt(lateralG * rmin)));
  return {
    throttle: s.speed < target ? 1 : 0,
    brake: s.speed > target * 1.06 ? Math.min(1, (s.speed - target) / 6) : 0,
    steer,
    handbrake: false,
  };
}

function driveLap(build: BuildState, maxSeconds = 180) {
  const v = VehiclePhysics.create(R, deriveVehicleSpec(build, car.manifest, car.parts), track);
  let lap = initialLap();
  let grassSeconds = 0;
  let maxSpeed = 0;
  for (let t = 0; t < maxSeconds; t += PHYSICS_STEP) {
    v.step(PHYSICS_STEP, autopilot(v));
    const s = v.snapshot();
    lap = updateLap(lap, track, s.trackS, v.time);
    if (s.surface === 'grass') grassSeconds += PHYSICS_STEP;
    maxSpeed = Math.max(maxSpeed, s.speed);
    if (lap.laps >= 1) break;
  }
  const upY = v.snapshot().upY;
  v.dispose();
  return { lap, grassSeconds, maxSpeed, upY };
}

describe('tam tur (otopilot)', () => {
  it('stok araç turu tamamlar, tur süresi kaydedilir, devrilmez', () => {
    const r = driveLap(base);
    expect(r.lap.laps).toBe(1);
    expect(r.lap.lastLap).not.toBeNull();
    expect(r.lap.lastLap ?? 0).toBeGreaterThan(40);
    expect(r.lap.lastLap ?? 999).toBeLessThan(150);
    expect(r.upY).toBeGreaterThan(0.8);
    expect(r.grassSeconds).toBeLessThan(15);
  });

  it('daha güçlü kurulum aynı turu daha hızlı bitirir', () => {
    const stock = driveLap(base);
    const tuned = driveLap(
      withPerformance(
        { ...base, parts: { ...base.parts, engine: 'blower_v8' } },
        { engine: 'race', transmission: 'sport5', brakes: 'race', suspension: 'stiff' },
      ),
    );
    expect(tuned.lap.laps).toBe(1);
    expect(tuned.lap.lastLap ?? 999).toBeLessThan(stock.lap.lastLap ?? 0);
  });
});
