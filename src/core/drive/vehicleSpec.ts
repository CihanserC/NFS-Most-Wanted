import { DEFAULT_DRIVING, type DrivingTuning } from './driving';
import type { BuildState } from '../build/types';
import type { PartsCatalog } from '../manifest/parts';
import type { CarManifest } from '../manifest/types';
import {
  buildWeightKg,
  camberGripFactors,
  engineSpec,
  hasSupercharger,
  perfData,
  sumDownforce,
  tireGrip,
  type EngineSpec,
} from '../performance/performance';
import { effectiveTrackMm } from '../stance/stance';
import type { Axle } from '../wheels/types';
import { tireOuterRadiusM } from '../wheels/wheels';

const MM = 0.001;
/** Stok sürüş yüksekliğinde süspansiyon dinlenme boyu (m) */
const BASE_REST_LENGTH = 0.2;
const MIN_REST_LENGTH = 0.07;
const MAX_TRAVEL = 0.14;
/** Ağırlık merkezinin zeminden yüksekliği, stok (m) */
const BASE_COM_HEIGHT = 0.55;
/** Gövde çekme katsayısı: 0.5 · ρ · Cd · A (N / (m/s)²) */
const DRAG_COEFFICIENT = 0.5 * 1.225 * 0.46 * 2.05;
/** Zemin basıncı katsayısı: downforce toplamı bununla çarpılır (N / (m/s)²) */
const DOWNFORCE_SCALE = 6;
const BASE_BRAKE_FORCE_PER_WHEEL = 3600;

export type AxleValues<T> = Record<Axle, T>;

/** Atölyeden fizik motoruna aktarılan değerler (§10.2). Three/Rapier'dan bağımsız saf veri. */
export type VehicleSpec = {
  massKg: number;
  wheelbase: number;
  /** Tekerlek yarıçapı (jant + lastik dış çapı) */
  wheelRadius: AxleValues<number>;
  /** Tekerlek merkezinin aks ekseninden yan konumu (spacer dahil), |x| */
  halfTrack: AxleValues<number>;
  /** Aksın araç orijinine göre z konumu */
  axleZ: AxleValues<number>;
  restLength: AxleValues<number>;
  maxTravel: number;
  stiffness: number;
  compression: number;
  relaxation: number;
  /** Yanal tutuş (Rapier frictionSlip'e ölçeklenir) */
  lateralGrip: AxleValues<number>;
  longitudinalGrip: AxleValues<number>;
  /** Tekerlek başına azami fren kuvveti (N) */
  brakeForcePerWheel: number;
  comHeight: number;
  dragCoefficient: number;
  downforceCoefficient: number;
  engine: EngineSpec;
  /** Gövde yan yuvarlanma sertliği çarpanı (süspansiyon sertliği) */
  rollStiffness: number;
  supercharged: boolean;
  /** Egzoz tipi: ses tonunu etkiler */
  exhaust: string;
  /** Araca özel sürüş ayarları */
  driving: DrivingTuning;
};

export function deriveVehicleSpec(
  build: Pick<BuildState, 'parts' | 'wheels' | 'tires' | 'stance' | 'performance' | 'brakes'>,
  manifest: CarManifest,
  catalog: PartsCatalog,
  driving: DrivingTuning = DEFAULT_DRIVING,
): VehicleSpec {
  const trackLimit = catalog.fenders?.[build.parts.fenders ?? '']?.trackWidthLimitMm;
  const limitMm = trackLimit ?? Number.POSITIVE_INFINITY;
  const susp = perfData.suspension[build.performance.suspension];
  const front = manifest.wheels.FL.position;
  const rear = manifest.wheels.RL.position;
  const axles: Axle[] = ['front', 'rear'];
  const pos = { front, rear };

  const wheelRadius = {} as AxleValues<number>;
  const halfTrack = {} as AxleValues<number>;
  const axleZ = {} as AxleValues<number>;
  const restLength = {} as AxleValues<number>;
  const lateralGrip = {} as AxleValues<number>;
  const longitudinalGrip = {} as AxleValues<number>;
  for (const axle of axles) {
    const p = pos[axle];
    wheelRadius[axle] = tireOuterRadiusM(build.wheels[axle].diameterIn, build.tires[axle]);
    // Spacer tekerleği dışarı iter.
    halfTrack[axle] = Math.abs(p[0]) + effectiveTrackMm(build.stance, axle, limitMm) * MM;
    axleZ[axle] = p[2];
    restLength[axle] = Math.max(
      MIN_REST_LENGTH,
      BASE_REST_LENGTH + build.stance.rideHeightMm[axle] * MM,
    );
    const tire = tireGrip(build.tires[axle]);
    const camber = camberGripFactors(build.stance.camberDeg[axle]);
    lateralGrip[axle] = tire.lateral * camber.lateral;
    longitudinalGrip[axle] = tire.longitudinal * camber.longitudinal;
  }

  const avgRide = (build.stance.rideHeightMm.front + build.stance.rideHeightMm.rear) / 2;
  const supercharged = hasSupercharger(build.parts);
  return {
    massKg: buildWeightKg(build, catalog, manifest.massKg),
    wheelbase: manifest.dimensions.wheelbase,
    wheelRadius,
    halfTrack,
    axleZ,
    restLength,
    maxTravel: MAX_TRAVEL,
    stiffness: susp.stiffness,
    compression: susp.compression,
    relaxation: susp.relaxation,
    lateralGrip,
    longitudinalGrip,
    brakeForcePerWheel:
      BASE_BRAKE_FORCE_PER_WHEEL * perfData.brakes[build.performance.brakes].force,
    // Alçak duruş ağırlık merkezini indirir, yüksek duruş (gasser) yükseltir.
    comHeight: Math.max(0.35, BASE_COM_HEIGHT + avgRide * MM * 0.8),
    dragCoefficient: DRAG_COEFFICIENT,
    downforceCoefficient: sumDownforce(build.parts, catalog) * DOWNFORCE_SCALE,
    engine: engineSpec(build.performance, supercharged),
    rollStiffness: susp.roll,
    supercharged,
    exhaust: build.parts.exhaust ?? 'rear_dual',
    driving,
  };
}
