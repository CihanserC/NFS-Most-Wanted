import { describe, expect, it } from 'vitest';
import { getCar } from '../../data/cars';
import { createDefaultBuild, withLook, withPerformance } from '../build/build';
import type { BuildState } from '../build/types';
import { normalizeFitment } from '../wheels/wheels';
import { initialDrivetrain, stepDrivetrain, steerAngle, type DriveInput } from './drivetrain';
import { deriveVehicleSpec, type VehicleSpec } from './vehicleSpec';

const car = getCar('vanta_stallion_70');
const base = createDefaultBuild(car.manifest);
const specOf = (b: BuildState) => deriveVehicleSpec(b, car.manifest, car.parts);
const full: DriveInput = { throttle: 1, brake: 0, steer: 0, handbrake: false };

/** Boylamasına basit simülasyon: motor itişi - gövde direnci, çekiş sınırlı. */
function simulate(spec: VehicleSpec, seconds: number) {
  const dt = 1 / 120;
  let state = initialDrivetrain(spec.engine.idleRpm);
  let v = 0;
  let t100: number | null = null;
  const tractionLimit = spec.longitudinalGrip.rear * 9.81 * spec.massKg * 0.55 * 1.6;
  for (let t = 0; t < seconds; t += dt) {
    const r = stepDrivetrain(state, full, spec, v, v, dt);
    state = r.state;
    const traction = Math.min(r.output.engineForce, tractionLimit);
    v += ((traction - spec.dragCoefficient * v * v) / spec.massKg) * dt;
    if (t100 === null && v * 3.6 >= 100) t100 = t;
  }
  return { v, t100, state };
}

describe('araç özellikleri (atölye -> fizik)', () => {
  it('stok kurulum makul değerler üretir', () => {
    const s = specOf(base);
    expect(s.massKg).toBeGreaterThan(1500);
    expect(s.wheelRadius.rear).toBeGreaterThan(0.3);
    expect(s.wheelRadius.rear).toBeLessThan(0.45);
    expect(s.restLength.front).toBeCloseTo(0.2, 3);
    expect(s.halfTrack.front).toBeCloseTo(0.78, 3);
  });

  it('alçak duruş süspansiyon boyunu ve ağırlık merkezini düşürür, yüksek duruş artırır', () => {
    const ride = (mm: number) =>
      specOf(withLook(base, { stance: { ...base.stance, rideHeightMm: { front: mm, rear: mm } } }));
    const stock = specOf(base);
    expect(ride(-70).restLength.front).toBeLessThan(stock.restLength.front);
    expect(ride(90).restLength.front).toBeGreaterThan(stock.restLength.front);
    expect(ride(-70).comHeight).toBeLessThan(stock.comHeight);
    expect(ride(90).comHeight).toBeGreaterThan(stock.comHeight);
  });

  it('jant + lastik çapı tekerlek yarıçapını belirler', () => {
    const big = specOf({
      ...base,
      ...normalizeFitment({
        wheels: {
          front: { ...base.wheels.front, diameterIn: 20 },
          rear: { ...base.wheels.rear, diameterIn: 20 },
        },
        tires: {
          front: { ...base.tires.front, aspect: 40 },
          rear: { ...base.tires.rear, aspect: 40 },
        },
      }),
    });
    expect(big.wheelRadius.rear).not.toBeCloseTo(specOf(base).wheelRadius.rear, 2);
  });

  it('lastik tipi ve genişliği tutuşu belirler; drag radial boylamasına yüksek, yanal düşük', () => {
    const stock = specOf(base);
    const slick = specOf({
      ...base,
      tires: {
        front: { ...base.tires.front, type: 'semi_slick' },
        rear: { ...base.tires.rear, type: 'semi_slick' },
      },
    });
    expect(slick.lateralGrip.rear).toBeGreaterThan(stock.lateralGrip.rear);
    const drag = specOf({
      ...base,
      tires: { ...base.tires, rear: { ...base.tires.rear, type: 'drag_radial' } },
    });
    expect(drag.longitudinalGrip.rear).toBeGreaterThan(stock.longitudinalGrip.rear);
    expect(drag.lateralGrip.rear).toBeLessThan(stock.lateralGrip.rear);
    const wide = specOf({
      ...base,
      tires: { ...base.tires, rear: { ...base.tires.rear, widthMm: 305 } },
    });
    expect(wide.lateralGrip.rear).toBeGreaterThan(stock.lateralGrip.rear);
  });

  it('aşırı kamber düz yol tutuşunu düşürür', () => {
    const extreme = specOf(
      withLook(base, { stance: { ...base.stance, camberDeg: { front: -8, rear: -8 } } }),
    );
    expect(extreme.longitudinalGrip.rear).toBeLessThan(specOf(base).longitudinalGrip.rear);
  });

  it('spoyler downforce ekler, fren parçası fren kuvvetini artırır', () => {
    const wing = specOf({ ...base, parts: { ...base.parts, spoiler_rear: 'high_wing' } });
    expect(wing.downforceCoefficient).toBeGreaterThan(specOf(base).downforceCoefficient);
    const race = specOf(withPerformance(base, { brakes: 'race' }));
    expect(race.brakeForcePerWheel).toBeGreaterThan(specOf(base).brakeForcePerWheel);
  });

  it('spacer çamurluk sınırıyla kısıtlanır ve iz genişliğine eklenir', () => {
    const spaced = specOf(
      withLook(base, { stance: { ...base.stance, trackMm: { front: 40, rear: 40 } } }),
    );
    expect(spaced.halfTrack.front).toBeCloseTo(0.78 + 0.015, 3);
  });
});

describe('motor ve şanzıman', () => {
  it('stok araç 0-100 km/s 3.5-9 sn arasında, yarış motoru daha hızlı', () => {
    const stock = simulate(specOf(base), 12);
    expect(stock.t100).not.toBeNull();
    expect(stock.t100 ?? 0).toBeGreaterThan(3.5);
    expect(stock.t100 ?? 99).toBeLessThan(9);
    const race = simulate(
      specOf(withPerformance(base, { engine: 'race', transmission: 'sport5' })),
      12,
    );
    expect(race.t100 ?? 99).toBeLessThan(stock.t100 ?? 0);
  });

  it('süperşarjör (blower_v8) daha çabuk hızlandırır', () => {
    const blown = simulate(specOf({ ...base, parts: { ...base.parts, engine: 'blower_v8' } }), 12);
    expect(blown.t100 ?? 99).toBeLessThan(simulate(specOf(base), 12).t100 ?? 0);
  });

  it('azami hız sonlu ve makul (180-300 km/s)', () => {
    const { v } = simulate(specOf(base), 60);
    expect(v * 3.6).toBeGreaterThan(180);
    expect(v * 3.6).toBeLessThan(300);
  });

  it('hızlanırken vites yükselir, rpm redline altında kalır', () => {
    const spec = specOf(base);
    const { state } = simulate(spec, 15);
    expect(state.gear).toBeGreaterThan(1);
    expect(state.rpm).toBeLessThanOrEqual(spec.engine.redlineRpm * 1.02);
    expect(state.rpm).toBeGreaterThanOrEqual(spec.engine.idleRpm);
  });

  it('durup S basınca geri vitese geçer, W basınca ileri', () => {
    const spec = specOf(base);
    const back: DriveInput = { throttle: 0, brake: 1, steer: 0, handbrake: false };
    let r = stepDrivetrain(initialDrivetrain(spec.engine.idleRpm), back, spec, 0, 0, 0.01);
    expect(r.state.reverse).toBe(true);
    expect(r.output.engineForce).toBeLessThan(0);
    r = stepDrivetrain(r.state, full, spec, -0.2, -0.2, 0.01);
    expect(r.state.reverse).toBe(false);
    expect(r.output.engineForce).toBeGreaterThan(0);
  });

  it('geri giderken W fren yapar, ileri giderken S fren yapar', () => {
    const spec = specOf(base);
    const reversing = { ...initialDrivetrain(spec.engine.idleRpm), reverse: true, gear: 0 };
    expect(stepDrivetrain(reversing, full, spec, -8, -8, 0.01).output.brake).toBe(1);
    const back: DriveInput = { throttle: 0, brake: 1, steer: 0, handbrake: false };
    const r = stepDrivetrain(initialDrivetrain(spec.engine.idleRpm), back, spec, 20, 20, 0.01);
    expect(r.output.brake).toBe(1);
    expect(r.state.reverse).toBe(false);
  });

  it('burnout: düşük hızda tam gazda rpm yükselir (debriyaj kayması)', () => {
    const spec = specOf(base);
    const r = stepDrivetrain(initialDrivetrain(spec.engine.idleRpm), full, spec, 0.5, 0.5, 0.01);
    expect(r.state.rpm).toBeGreaterThan(3000);
  });

  it('direksiyon açısı hızla daralır', () => {
    expect(Math.abs(steerAngle(1, 3))).toBeGreaterThan(Math.abs(steerAngle(1, 50)));
    expect(steerAngle(-1, 0)).toBeLessThan(0);
  });
});
