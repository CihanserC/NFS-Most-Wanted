import type { DynamicRayCastVehicleController, RigidBody, World } from '@dimforge/rapier3d-compat';
import {
  initialDrivetrain,
  stepDrivetrain,
  steerAngle,
  type DriveInput,
  type DrivetrainState,
} from '../../core/drive/drivetrain';
import { computeBarriers } from '../../core/drive/barriers';
import { GANTRY_PILLAR_M, startGantry } from '../../core/drive/scenery';
import {
  queryTrack,
  spawnPose,
  type Surface,
  type Track,
  type TrackSample,
} from '../../core/drive/track';
import { combinedScale, lateralForce, slipAngle } from '../../core/drive/tire';
import type { VehicleSpec } from '../../core/drive/vehicleSpec';
import type { Rapier } from './rapier';

export const PHYSICS_STEP = 1 / 120;
const GRAVITY = 9.81;
/** Raycast aracı bağlantı noktası şasi orijininin bu kadar üstünde (m) */
const CONNECTION_Y = 0.1;
/** Şasi kutusu (yarı ölçüler) ve orijine göre konumu */
const CHASSIS_HALF = [0.88, 0.32, 2.25] as const;
const CHASSIS_CENTER_Y = 0.12;
/** Boyuna tutuş (Rapier frictionSlip): çekiş/fren sınırı */
const FRICTION_BASE = 1.25;
const ROLLING_RESISTANCE = 0.015;
/** Direksiyon girişinin tam kilitten kilide çıkma hızı (1/sn) ve bırakınca merkeze dönme hızı */
const STEER_RATE = 6;
const STEER_RETURN_RATE = 8;
/** Arcade direksiyon yardımı bu hızdan (m/s) itibaren devreye girer, ARCADE_FULL_SPEED'de tam */
const ARCADE_MIN_SPEED = 2;
const ARCADE_FULL_SPEED = 7;
/** Tam kilitte ön tekerlek açısı (kinematik yalpalama sınırı için, rad) */
const ARCADE_LOCK = 0.55;
/** El frenindeyken yardımların ölçeği: kontrollü drift mümkün kalsın */
const ARCADE_HANDBRAKE_SCALE = 0.15;
/** Tekerlek patinaj hızının (m/s) boşalma hızı */
const SLIP_DECAY = 10;
const SPIN_INERTIA_MASS = 110;
/** Şasi ters dönerse bu süre sonra otomatik düzeltilir (sn) */
const FLIP_RESET_SECONDS = 2;
const MAX_SUSPENSION_FORCE = 1e5;
/** Bariyer kapsülü yarıçapı (m): görsel bariyer 0.8 m kalınlığında, 1.2 m yüksekliğinde */
const BARRIER_RADIUS = 0.55;
/** Gaz kesilince egzoz alevinin süresi (sn) */
const FLAME_SECONDS = 0.28;

export const WHEEL_ORDER = ['FL', 'FR', 'RL', 'RR'] as const;
const AXLE_OF = ['front', 'front', 'rear', 'rear'] as const;

export type WheelSnapshot = {
  contact: boolean;
  suspensionLength: number;
  /** Dönüş açısı (rad, ileri yuvarlanma +) */
  rotation: number;
  steer: number;
  /** Zemin temas noktası (dünya) */
  contactX: number;
  contactZ: number;
  /** 0..1: kayma şiddeti (iz, duman, ses) */
  slip: number;
  surface: Surface;
};

export type VehicleSnapshot = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  speed: number;
  forwardSpeed: number;
  lateralSpeed: number;
  /** Arka tekerlek patinaj hızı (m/s) */
  slipSpeed: number;
  rpm: number;
  gear: number;
  reverse: boolean;
  throttle: number;
  /** Gaz bırakıldığı an (egzoz alevi için) */
  liftOff: boolean;
  braking: number;
  handbrake: boolean;
  trackIndex: number;
  trackS: number;
  surface: Surface;
  wheels: WheelSnapshot[];
  /** Şasinin dünya yukarı vektörünün y bileşeni (1 = dik) */
  upY: number;
};

type Vec3 = { x: number; y: number; z: number };

const quatRotate = (q: { x: number; y: number; z: number; w: number }, v: Vec3): Vec3 => {
  const ix = q.w * v.x + q.y * v.z - q.z * v.y;
  const iy = q.w * v.y + q.z * v.x - q.x * v.z;
  const iz = q.w * v.z + q.x * v.y - q.y * v.x;
  const iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
};

/**
 * Rapier raycast araç kontrolcüsü + saf güç aktarma modeli. React'ten bağımsızdır;
 * DriveScene her karede sabit adımla step() çağırır ve snapshot() okur.
 */
export class VehiclePhysics {
  readonly world: World;
  readonly chassis: RigidBody;
  readonly controller: DynamicRayCastVehicleController;
  /** Dinlenmede (yerleştikten sonra) süspansiyon boyları ve orijinin zemin yüksekliği */
  restSuspension = [0, 0, 0, 0];
  restHeight = 0;
  drivetrain: DrivetrainState;
  private steer = 0;
  private slipSpeed = 0;
  private wheelRotation = [0, 0, 0, 0];
  private hints = [0, 0, 0, 0];
  private prevThrottle = 0;
  private flipTime = 0;
  private lastTrackIndex = 0;
  time = 0;

  private constructor(
    private readonly R: Rapier,
    readonly spec: VehicleSpec,
    readonly track: Track,
  ) {
    this.world = new R.World({ x: 0, y: -GRAVITY, z: 0 });
    this.world.timestep = PHYSICS_STEP;

    const ground = R.ColliderDesc.cuboid(4000, 1, 4000).setTranslation(0, -1, 0).setFriction(1);
    this.world.createCollider(ground);
    this.buildBarriers();

    this.chassis = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setLinearDamping(0.02).setAngularDamping(0.7).setCcdEnabled(true),
    );
    this.world.createCollider(
      R.ColliderDesc.cuboid(...CHASSIS_HALF)
        .setTranslation(0, CHASSIS_CENTER_Y, 0)
        .setMass(spec.massKg)
        .setFriction(0.2)
        .setRestitution(0),
      this.chassis,
    );

    this.controller = this.world.createVehicleController(this.chassis);
    for (let i = 0; i < 4; i++) {
      const axle = AXLE_OF[i] as 'front' | 'rear';
      const side = i % 2 === 0 ? 1 : -1;
      this.controller.addWheel(
        { x: side * spec.halfTrack[axle], y: CONNECTION_Y, z: spec.axleZ[axle] },
        { x: 0, y: -1, z: 0 },
        { x: -1, y: 0, z: 0 },
        spec.restLength[axle],
        spec.wheelRadius[axle],
      );
      this.controller.setWheelMaxSuspensionTravel(i, spec.maxTravel);
      this.controller.setWheelSuspensionStiffness(i, spec.stiffness);
      this.controller.setWheelSuspensionCompression(i, spec.compression);
      this.controller.setWheelSuspensionRelaxation(i, spec.relaxation);
      this.controller.setWheelMaxSuspensionForce(i, MAX_SUSPENSION_FORCE);
      this.controller.setWheelFrictionSlip(i, FRICTION_BASE * spec.lateralGrip[axle]);
      // Yanal kuvvet kendi lastik modelimizle (kayma açısı eğrisi) uygulanır; Rapier'ınki kapalı.
      this.controller.setWheelSideFrictionStiffness(i, 0.0001);
    }
    this.drivetrain = initialDrivetrain(spec.engine.idleRpm);
  }

  static create(R: Rapier, spec: VehicleSpec, track: Track): VehiclePhysics {
    const v = new VehiclePhysics(R, spec, track);
    v.reset();
    v.settle();
    return v;
  }

  /**
   * Pist kenarlarına bariyer çarpışma şekilleri (görselle aynı zincir). Kutu yerine yatay kapsül:
   * ardışık kapsüller uç kürelerini paylaştığından eklem yerinde çıkıntı olmaz; bariyere
   * sürtünen araç kutu köşesine takılıp savrulmaz.
   */
  private buildBarriers(): void {
    const s45 = Math.SQRT1_2;
    for (const seg of computeBarriers(this.track)) {
      const sy = Math.sin(seg.yaw / 2);
      const cy = Math.cos(seg.yaw / 2);
      // Önce x etrafında 90° (kapsül ekseni y -> z), sonra yaw
      const rotation = { x: cy * s45, y: sy * s45, z: -sy * s45, w: cy * s45 };
      this.world.createCollider(
        this.R.ColliderDesc.capsule(seg.halfSpan, BARRIER_RADIUS)
          .setTranslation(seg.x, BARRIER_RADIUS + 0.05, seg.z)
          .setRotation(rotation)
          .setFriction(0.1)
          .setRestitution(0),
      );
    }
    // Başlangıç kapısının direkleri (görseldeki grup: yerel x ekseni dünyada (cos yaw, 0, -sin yaw))
    const g = startGantry(this.track);
    const half = GANTRY_PILLAR_M / 2;
    for (const side of [1, -1]) {
      this.world.createCollider(
        this.R.ColliderDesc.cuboid(half, 4, half)
          .setTranslation(
            g.x + Math.cos(g.yaw) * (g.span / 2) * side,
            4,
            g.z - Math.sin(g.yaw) * (g.span / 2) * side,
          )
          .setRotation({ x: 0, y: Math.sin(g.yaw / 2), z: 0, w: Math.cos(g.yaw / 2) })
          .setFriction(0.1)
          .setRestitution(0),
      );
    }
  }

  /** Aracı yerleştirip süspansiyon ve yükseklik dinlenme değerlerini ölçer. */
  private settle(): void {
    const noInput: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    for (let i = 0; i < 240; i++) this.stepPhysics(PHYSICS_STEP, noInput, false);
    this.restHeight = this.chassis.translation().y;
    for (let i = 0; i < 4; i++)
      this.restSuspension[i] =
        this.controller.wheelSuspensionLength(i) ?? this.spec.restLength.front;
    this.time = 0;
    this.drivetrain = initialDrivetrain(this.spec.engine.idleRpm);
    this.slipSpeed = 0;
    this.slipAngles = [0, 0, 0, 0];
    this.steer = 0;
  }

  /** Aracı belirtilen pist noktasına, pist yönünde ve duruşta koyar (null: başlangıç). */
  reset(atIndex: number | null = null): void {
    const { track } = this;
    let x: number;
    let z: number;
    let heading: number;
    if (atIndex === null) {
      const p = spawnPose(track);
      ({ x, z, heading } = p);
    } else {
      const s = track.samples[atIndex] as TrackSample;
      x = s.x;
      z = s.z;
      heading = Math.atan2(s.tx, s.tz);
    }
    const y = this.restHeight > 0 ? this.restHeight + 0.15 : 0.85;
    this.chassis.setTranslation({ x, y, z }, true);
    this.chassis.setRotation(
      { x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) },
      true,
    );
    this.chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.slipSpeed = 0;
    this.slipAngles = [0, 0, 0, 0];
    this.flipTime = 0;
    this.drivetrain = initialDrivetrain(this.spec.engine.idleRpm);
  }

  /** Şu anki pist konumunda, yolun yönüne bakacak şekilde yeniden doğur. */
  resetOnTrack(): void {
    this.reset(this.lastTrackIndex);
  }

  /** Dinamik adım: giriş -> güç aktarma -> tekerlek kuvvetleri -> fizik adımı. */
  step(dt: number, input: DriveInput): void {
    this.stepPhysics(dt, input, true);
  }

  private stepPhysics(dt: number, input: DriveInput, live: boolean): void {
    const { spec, controller, chassis } = this;
    this.time += dt;
    const q = chassis.rotation();
    const fwd = quatRotate(q, { x: 0, y: 0, z: 1 });
    const left = quatRotate(q, { x: 1, y: 0, z: 0 });
    const up = quatRotate(q, { x: 0, y: 1, z: 0 });
    const vel = chassis.linvel();
    const forwardSpeed = vel.x * fwd.x + vel.y * fwd.y + vel.z * fwd.z;
    const lateralSpeed = vel.x * left.x + vel.y * left.y + vel.z * left.z;
    const speed = Math.hypot(vel.x, vel.z);

    // Direksiyon: hıza duyarlı açı, yumuşatılmış giriş
    const rate = Math.abs(input.steer) < Math.abs(this.steer) ? STEER_RETURN_RATE : STEER_RATE;
    this.steer += Math.max(-rate * dt, Math.min(rate * dt, input.steer - this.steer));
    const steerRad = steerAngle(this.steer, Math.abs(forwardSpeed), spec.wheelbase);

    const driven = forwardSpeed + this.slipSpeed * Math.sign(this.drivetrain.reverse ? -1 : 1);
    const out = stepDrivetrain(this.drivetrain, input, spec, forwardSpeed, driven, dt);
    this.drivetrain = out.state;
    const o = out.output;

    // Fren: ön/arka dağılım, el freni arkayı kilitler
    const brakeForce = o.brake * spec.brakeForcePerWheel;
    // Düşük hızda el freni arka tekerlekleri tamamen tutar (burnout); hızlıyken kaydırır (drift).
    const handbrake = input.handbrake ? spec.brakeForcePerWheel * (speed < 3 ? 3.2 : 1.1) : 0;

    let surfaceMain: Surface = 'asphalt';
    const wheels: { surface: Surface; contact: boolean }[] = [];
    for (let i = 0; i < 4; i++) {
      const axle = AXLE_OF[i] as 'front' | 'rear';
      const contact = controller.wheelIsInContact(i);
      let surface: Surface = 'asphalt';
      if (contact) {
        const cp = controller.wheelContactPoint(i);
        if (cp) {
          const tq = queryTrack(this.track, cp.x, cp.z, this.hints[i], 60);
          this.hints[i] = tq.index;
          surface = tq.surface;
        }
      }
      wheels.push({ surface, contact });
      if (i === 2) surfaceMain = surface;
      // Boyuna çekiş (gaz/fren) ayrı katsayı: çimde yanal tutuş düşük kalsın ama araç
      // ileri/geri makul hızlanabilsin
      const surfaceTraction = this.track.config.tractionBySurface[surface];
      const rearBoost = axle === 'rear' && input.handbrake ? spec.driving.handbrakeRearGrip : 1;
      controller.setWheelFrictionSlip(
        i,
        FRICTION_BASE * spec.lateralGrip[axle] * surfaceTraction * rearBoost,
      );
      controller.setWheelSteering(i, axle === 'front' ? steerRad : 0);
      // Rapier, motor kuvveti varken freni yok sayar: düşük hızda el freni + gaz = çizgi kilitli burnout.
      const holdRear = input.handbrake && speed < 3;
      controller.setWheelEngineForce(i, axle === 'rear' && !holdRear ? o.engineForce / 2 : 0);
      const bias = axle === 'front' ? spec.driving.frontBrakeBias : 1 - spec.driving.frontBrakeBias;
      // Rapier fren değeri adım başına azami itkidir (N·s): kuvveti dt ile çarp.
      controller.setWheelBrake(i, (brakeForce * bias * 2 + (axle === 'rear' ? handbrake : 0)) * dt);
    }

    // Patinaj hızı: itiş çekiş sınırını aşarsa tekerlek hızı araç hızını geçer (burnout).
    const rearLoad = spec.massKg * GRAVITY * 0.55;
    const tractionLimit =
      FRICTION_BASE *
      spec.longitudinalGrip.rear *
      rearLoad *
      this.track.config.tractionBySurface[surfaceMain];
    const excess = Math.abs(o.engineForce) - tractionLimit;
    if (excess > 0 && o.throttle > 0.5)
      this.slipSpeed = Math.min(40, this.slipSpeed + (excess / SPIN_INERTIA_MASS) * dt);
    else this.slipSpeed = Math.max(0, this.slipSpeed - SLIP_DECAY * dt);

    // Gövde kuvvetleri: aerodinamik sürtünme, bastırma, yuvarlanma direnci
    chassis.resetForces(true);
    chassis.resetTorques(true);
    const hSpeed = Math.hypot(vel.x, vel.z);
    if (hSpeed > 0.01) {
      const drag = spec.dragCoefficient * hSpeed;
      const rolling =
        ROLLING_RESISTANCE *
        spec.massKg *
        GRAVITY *
        this.track.config.rollingResistanceBySurface[surfaceMain];
      const f = drag * hSpeed + rolling;
      chassis.addForce({ x: (-vel.x / hSpeed) * f, y: 0, z: (-vel.z / hSpeed) * f }, true);
    }
    chassis.addForce({ x: 0, y: -spec.downforceCoefficient * hSpeed * hSpeed, z: 0 }, true);

    // Yanal lastik kuvvetleri: tekerlek başına kayma açısı -> kuvvet, temas noktasına uygulanır
    const com = chassis.worldCom();
    const ang = chassis.angvel();
    for (let i = 0; i < 4; i++) {
      const info = wheels[i];
      if (!info?.contact) {
        this.slipAngles[i] = 0;
        continue;
      }
      const axle = AXLE_OF[i] as 'front' | 'rear';
      const cp = controller.wheelContactPoint(i);
      const fz = Math.min(controller.wheelSuspensionForce(i) ?? 0, (spec.massKg * GRAVITY) / 2);
      if (!cp || fz <= 0) continue;
      const rx = cp.x - com.x;
      const ry = cp.y - com.y;
      const rz = cp.z - com.z;
      // Temas noktasının hızı: v + ω × r
      const px = vel.x + (ang.y * rz - ang.z * ry);
      const pz = vel.z + (ang.x * ry - ang.y * rx);
      const steerHere = axle === 'front' ? steerRad : 0;
      const sn = Math.sin(steerHere);
      const cs = Math.cos(steerHere);
      // Tekerlek ekseni (yatay): ileri = fwd·cos + left·sin, sol = left·cos − fwd·sin
      const wfx = fwd.x * cs + left.x * sn;
      const wfz = fwd.z * cs + left.z * sn;
      const wlx = left.x * cs - fwd.x * sn;
      const wlz = left.z * cs - fwd.z * sn;
      const vLong = px * wfx + pz * wfz;
      const vLat = px * wlx + pz * wlz;
      // Gevşeme: lastik kuvveti kayma açısını RELAX_LENGTH metrelik yolda yakalar (anlık doyma yok)
      const raw = slipAngle(vLat, vLong);
      const follow = Math.min(
        1,
        (Math.max(Math.abs(vLong), 3) * dt) / spec.driving.tireRelaxLength,
      );
      const prevAlpha = this.slipAngles[i] ?? 0;
      const alpha = prevAlpha + (raw - prevAlpha) * follow;
      this.slipAngles[i] = alpha;
      const surfaceGrip = this.track.config.gripBySurface[info.surface];
      const rearBoost = axle === 'rear' && input.handbrake ? spec.driving.handbrakeRearGrip : 1;
      const mu = spec.driving.lateralMu * spec.lateralGrip[axle] * surfaceGrip * rearBoost;
      const fxUsed = Math.abs(controller.wheelForwardImpulse(i) ?? 0) / dt;
      const usage = fxUsed / (FRICTION_BASE * spec.longitudinalGrip[axle] * fz + 1);
      // Kararlılık: kuvvet, tekerleğin yanal hızını tek adımda sıfırlayandan büyük olamaz
      const fyMax = (0.3 * (spec.massKg / 4) * Math.abs(vLat)) / dt;
      const fyRaw =
        lateralForce(alpha * (axle === 'rear' ? spec.driving.rearSlipScale : 1), fz, mu) *
        combinedScale(usage);
      const fy = Math.max(-fyMax, Math.min(fyMax, fyRaw));
      // Yanal kuvvet, ağırlık merkezi yüksekliğine yakın bir noktadan uygulanır (Rapier roll influence gibi);
      // yerden uygulanırsa gövde aşırı yatar ve tekerlekler yerden kalkar.
      const pointY = com.y + ry * spec.driving.rollInfluence;
      chassis.addForceAtPoint(
        { x: wlx * fy, y: 0, z: wlz * fy },
        { x: cp.x, y: pointY, z: cp.z },
        true,
      );
    }

    this.applyArcadeSteering(dt, input, forwardSpeed, wheels);
    controller.updateVehicle(dt);
    this.world.step();

    // Devrilme kontrolü
    if (live) {
      this.flipTime = up.y < 0.25 ? this.flipTime + dt : 0;
      if (this.flipTime > FLIP_RESET_SECONDS) this.resetOnTrack();
    }

    for (let i = 0; i < 4; i++) {
      const w = controller.wheelRotation(i) ?? 0;
      this.wheelRotation[i] = w;
    }
    this.lastWheels = wheels;
    this.lastInput = input;
    this.lastForward = forwardSpeed;
    this.lastLateral = lateralSpeed;
    this.lastSteer = steerRad;
    this.lastSpeed = speed;
    // Gaz kesilince egzoz alevi kısa süre sürer.
    if (this.prevThrottle > 0.6 && o.throttle < 0.1 && this.drivetrain.rpm > 3500)
      this.flameTimer = FLAME_SECONDS;
    else this.flameTimer = Math.max(0, this.flameTimer - dt);
    this.liftOff = this.flameTimer > 0;
    this.prevThrottle = o.throttle;
    this.lastBrake = o.brake;
  }

  /**
   * Arcade direksiyon (NFS tarzı): lastik modeli gerçekçi tutuş sınırında kalır; bu yardım
   * direksiyon girişinden hedef yalpalama hızı hesaplar ve gövdeyi ona doğru döndürür, hız
   * vektörünü de gövde yönüne çevirir (büyüklüğü korunur: virajda hız kaybı yok). En az üç
   * tekerlek yerdeyken çalışır; el freninde zayıflar ki drift yapılabilsin.
   */
  private applyArcadeSteering(
    dt: number,
    input: DriveInput,
    forwardSpeed: number,
    wheels: { contact: boolean }[],
  ): void {
    const { chassis, spec } = this;
    const d = spec.driving;
    if (wheels.filter((w) => w.contact).length < 3) return;
    const v = Math.abs(forwardSpeed);
    const fade = Math.min(
      1,
      Math.max(0, (v - ARCADE_MIN_SPEED) / (ARCADE_FULL_SPEED - ARCADE_MIN_SPEED)),
    );
    if (fade <= 0) return;
    const scale = input.handbrake ? ARCADE_HANDBRAKE_SCALE : 1;
    const direction = Math.sign(forwardSpeed);
    // Hedef yalpalama: kinematik sınır (tam kilit) ile hedef yanal ivme sınırının küçüğü
    const maxYaw = Math.min(
      (v * Math.tan(ARCADE_LOCK)) / spec.wheelbase,
      d.arcadeLateralAccel / Math.max(v, 0.1),
    );
    const target = this.steer * direction * maxYaw;
    const w = chassis.angvel();
    const blend = fade * scale * Math.min(1, d.yawResponse * dt);
    const inertia = chassis.principalInertia().y;
    chassis.applyTorqueImpulse({ x: 0, y: inertia * (target - w.y) * blend, z: 0 }, true);

    // Hız hizalama: yatay hız vektörü gövde yönüne doğru döner (geri giderken arkaya)
    const vel = chassis.linvel();
    const speed = Math.hypot(vel.x, vel.z);
    if (speed < 0.5) return;
    const q = chassis.rotation();
    const fwd = quatRotate(q, { x: 0, y: 0, z: 1 });
    const heading = Math.atan2(fwd.x * direction, fwd.z * direction);
    const course = Math.atan2(vel.x, vel.z);
    let beta = heading - course;
    while (beta > Math.PI) beta -= 2 * Math.PI;
    while (beta < -Math.PI) beta += 2 * Math.PI;
    const turn = beta * fade * scale * Math.min(1, d.gripAssist * dt);
    const next = course + turn;
    const mass = chassis.mass();
    chassis.applyImpulse(
      {
        x: (Math.sin(next) * speed - vel.x) * mass,
        y: 0,
        z: (Math.cos(next) * speed - vel.z) * mass,
      },
      true,
    );
  }

  /** Tekerlek başına son kayma açısı (rad) */
  private slipAngles = [0, 0, 0, 0];
  private lastWheels: { surface: Surface; contact: boolean }[] = [];
  private lastInput: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  private lastForward = 0;
  private lastLateral = 0;
  private lastSteer = 0;
  private lastSpeed = 0;
  private lastBrake = 0;
  private liftOff = false;
  private flameTimer = 0;

  snapshot(): VehicleSnapshot {
    const t = this.chassis.translation();
    const q = this.chassis.rotation();
    const up = quatRotate(q, { x: 0, y: 1, z: 0 });
    const tq = queryTrack(this.track, t.x, t.z, this.lastTrackIndex, 80);
    this.lastTrackIndex = tq.index;
    const speed = this.lastSpeed;
    const sliding = Math.abs(this.lastLateral) > 2.5 && speed > 6;
    const braking = this.lastBrake > 0.85 && speed > 10;
    const wheels: WheelSnapshot[] = [];
    for (let i = 0; i < 4; i++) {
      const axle = AXLE_OF[i];
      const info = this.lastWheels[i];
      const cp = this.controller.wheelContactPoint(i);
      const spinning = axle === 'rear' && this.slipSpeed > 3;
      let slip = 0;
      if (info?.contact) {
        slip = Math.max(
          sliding ? Math.min(1, (Math.abs(this.lastLateral) - 2) / 6) : 0,
          spinning ? Math.min(1, this.slipSpeed / 12) : 0,
          braking ? 0.7 : 0,
        );
      }
      wheels.push({
        contact: info?.contact ?? false,
        suspensionLength:
          this.controller.wheelSuspensionLength(i) ??
          this.spec.restLength[axle as 'front' | 'rear'],
        rotation: this.wheelRotation[i] ?? 0,
        steer: axle === 'front' ? this.lastSteer : 0,
        contactX: cp?.x ?? t.x,
        contactZ: cp?.z ?? t.z,
        slip,
        surface: info?.surface ?? 'asphalt',
      });
    }
    return {
      position: [t.x, t.y, t.z],
      quaternion: [q.x, q.y, q.z, q.w],
      speed,
      forwardSpeed: this.lastForward,
      lateralSpeed: this.lastLateral,
      slipSpeed: this.slipSpeed,
      rpm: this.drivetrain.rpm,
      gear: this.drivetrain.gear,
      reverse: this.drivetrain.reverse,
      throttle: this.lastInput.throttle,
      liftOff: this.liftOff,
      braking: this.lastBrake,
      handbrake: this.lastInput.handbrake,
      trackIndex: tq.index,
      trackS: tq.s,
      surface: tq.surface,
      wheels,
      upY: up.y,
    };
  }

  dispose(): void {
    this.world.free();
  }
}
