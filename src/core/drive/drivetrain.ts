import { perfData } from '../performance/performance';
import type { VehicleSpec } from './vehicleSpec';

export type DriveInput = {
  /** 0..1 */
  throttle: number;
  /** 0..1 */
  brake: number;
  /** -1 (sağ) .. 1 (sol) */
  steer: number;
  handbrake: boolean;
};

export type DrivetrainState = {
  /** 1..N ileri, 0 = geri */
  gear: number;
  reverse: boolean;
  rpm: number;
  /** Vites değişiminde güç kesintisi için kalan süre (s) */
  shiftTimer: number;
};

export const initialDrivetrain = (idleRpm: number): DrivetrainState => ({
  gear: 1,
  reverse: false,
  rpm: idleRpm,
  shiftTimer: 0,
});

export type DriveOutput = {
  /** Toplam itiş kuvveti (N), arka tekerleklere bölünür; geri vitesde negatif */
  engineForce: number;
  /** 0..1 fren talebi */
  brake: number;
  /** Güç aktarma organındaki gaz (0..1, gösterge/ses için) */
  throttle: number;
};

const SHIFT_TIME = 0.22;
const UPSHIFT_FRACTION = 0.93;
const DOWNSHIFT_FRACTION = 0.42;
/** Bu hızın altında yönü değiştirmek için fren/gaz bekler (m/s) */
const REVERSE_SPEED = 0.8;
/** Geri vitesteki azami hız (m/s) */
const REVERSE_TOP_SPEED = 9;
/** Kalkışta debriyaj kayması: gaz kadar rpm'i bu değere çeker */
const LAUNCH_RPM = 3200;

/**
 * Motor + şanzıman adımı. forwardSpeed: araç boyuna hızı (m/s, ileri +).
 * drivenWheelSpeed: sürülen tekerleklerin çevresel hızı (m/s); patinajda forwardSpeed'den büyük olabilir.
 */
export function stepDrivetrain(
  state: DrivetrainState,
  input: DriveInput,
  spec: VehicleSpec,
  forwardSpeed: number,
  drivenWheelSpeed: number,
  dt: number,
): { state: DrivetrainState; output: DriveOutput } {
  const { engine } = spec;
  const radius = spec.wheelRadius.rear;
  let { gear, reverse, shiftTimer } = state;
  shiftTimer = Math.max(0, shiftTimer - dt);

  // Yön: ileri hareketteyken S fren, durunca geri; geri giderken W fren, durunca ileri.
  let throttle = input.throttle;
  let brake = input.brake;
  let reverseThrottle = 0;
  if (!reverse) {
    if (forwardSpeed < REVERSE_SPEED && input.brake > 0.1 && input.throttle < 0.05) {
      reverse = true;
      gear = 0;
    }
  } else if (forwardSpeed > -REVERSE_SPEED && input.throttle > 0.1 && input.brake < 0.05) {
    reverse = false;
    gear = 1;
  }
  if (reverse) {
    reverseThrottle = input.brake;
    brake = input.throttle; // geri giderken W = fren
    throttle = 0;
  }

  const ratio = reverse ? perfData.reverseGear : (engine.gears[gear - 1] ?? 1);
  const wheelOmega = Math.abs(drivenWheelSpeed) / radius;
  const geared = ((wheelOmega * ratio * engine.finalDrive) / (2 * Math.PI)) * 60;
  const demand = reverse ? reverseThrottle : throttle;
  const launch = (Math.abs(drivenWheelSpeed) < 9 ? LAUNCH_RPM : 0) * demand;
  let rpm = Math.max(engine.idleRpm, geared, launch);
  rpm = Math.min(rpm, engine.redlineRpm * 1.02);

  // Otomatik vites
  if (!reverse && shiftTimer === 0) {
    const top = engine.gears.length;
    if (rpm > engine.redlineRpm * UPSHIFT_FRACTION && gear < top && demand > 0.3) {
      gear += 1;
      shiftTimer = SHIFT_TIME;
    } else if (
      gear > 1 &&
      geared < engine.redlineRpm * DOWNSHIFT_FRACTION &&
      (geared * (engine.gears[gear - 2] ?? ratio)) / ratio < engine.redlineRpm * 0.8
    ) {
      gear -= 1;
      shiftTimer = SHIFT_TIME * 0.6;
    }
  }

  const torque = engine.torqueAt(rpm) * demand;
  const cut = shiftTimer > 0 ? 0 : 1;
  const wheelForce = (torque * ratio * engine.finalDrive * perfData.drivelineEfficiency) / radius;
  // Gaz bırakınca motor freni (düşük, rpm ile artan)
  const engineBrake = demand < 0.05 ? (rpm / engine.redlineRpm) * 380 : 0;
  const direction = reverse ? -1 : 1;
  // Geri vites hız sınırı
  const reverseCut = reverse && forwardSpeed < -REVERSE_TOP_SPEED ? 0 : 1;
  const force = direction * wheelForce * cut * reverseCut - Math.sign(forwardSpeed) * engineBrake;

  return {
    state: { gear, reverse, rpm, shiftTimer },
    output: {
      engineForce: force,
      brake: Math.min(1, brake),
      throttle: demand,
    },
  };
}

/** Kilitten kilide ön tekerlek açısı (rad), park hızında */
const STEER_MAX = 0.55;
/** Direksiyonun hedeflediği yanal ivme (m/s²): kinematik açı bu ivmeye göre hesaplanır */
const STEER_TARGET_ACCEL = 12;
/** Lastiğin tepe kayma açısı (rad, tire.ts'deki PEAK_SLIP_ANGLE ile uyumlu) üzerine pay */
const STEER_SLIP_MARGIN = 0.13;

/**
 * Hıza duyarlı direksiyon açısı (rad). Tam kilit; aracı hedef yanal ivmede döndüren kinematik açı
 * (Ackermann: L·a/v²) + lastiğin tepe kayma açısı ile sınırlanır. Böylece klavyeyle tam direksiyon
 * ön lastikleri tepe noktasının ötesine itip tutuşu düşürmez (yüksek hızda "düz gitme" olmaz).
 */
export function steerAngle(steerInput: number, speedMs: number, wheelbase = 2.7): number {
  const v2 = Math.max(speedMs * speedMs, 1);
  const kinematic = Math.atan((wheelbase * STEER_TARGET_ACCEL) / v2);
  return steerInput * Math.min(STEER_MAX, kinematic + STEER_SLIP_MARGIN);
}
