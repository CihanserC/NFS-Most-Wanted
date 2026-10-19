import { applyAssists, DEFAULT_ASSISTS } from '../../core/drive/assists';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Quaternion, SpotLight, Vector3, type Group } from 'three';
import { CarRig } from '../../car/CarRig';
import type { WheelPose } from '../../car/wheelPose';
import { initialLap, updateLap, type LapState } from '../../core/drive/lap';
import type { Track } from '../../core/drive/track';
import { deriveVehicleSpec } from '../../core/drive/vehicleSpec';
import { useAudioStore } from '../../core/store/audioStore';
import { useDriveStore } from '../../core/store/driveStore';
import { useBuildStore } from '../../core/store/stores';
import { getCar } from '../../data/cars';
import { EngineAudio } from '../audio/EngineAudio';
import { DriveCamera } from '../camera/DriveCamera';
import { VehicleEffects } from '../fx/VehicleEffects';
import { createInputSource, type InputSource } from '../input';
import { loadRapier } from '../physics/rapier';
import { PHYSICS_STEP, VehiclePhysics, type VehicleSnapshot } from '../physics/VehiclePhysics';

/** Bir karede en fazla bu kadar fizik adımı; gerisi atılır (yavaş cihazda zaman yavaşlar) */
const MAX_STEPS_PER_FRAME = 10;
/** HUD güncelleme aralığı (sn) */
const HUD_INTERVAL = 0.08;
const HEADLIGHT = { x: 0.62, y: 0.72, reach: 28, angle: 0.5, penumbra: 0.6, intensity: 420 };

const tmpQuat = new Quaternion();
const tmpForward = new Vector3();

/** Geliştirme: konsoldan giriş/fizik durumunu incelemek için. */
type DriveDebug = {
  input: InputSource | null;
  physics: VehiclePhysics | null;
};

function Headlights({
  rigRef,
  halfLength,
  strong,
}: {
  rigRef: RefObject<Group | null>;
  halfLength: number;
  strong: boolean;
}) {
  const left = useRef<SpotLight>(null);
  const right = useRef<SpotLight>(null);
  useEffect(() => {
    const g = rigRef.current;
    const spots = [left.current, right.current];
    if (!g) return;
    spots.forEach((s, i) => {
      if (!s) return;
      const side = i === 0 ? 1 : -1;
      g.add(s.target);
      s.target.position.set(side * HEADLIGHT.x * 0.7, 0, halfLength + HEADLIGHT.reach);
    });
    return () => {
      spots.forEach((s) => s && g.remove(s.target));
    };
  }, [rigRef, halfLength]);
  // Gündüz (gün batımı) farlar yanmaz: yakın zemin ışığı patlar.
  if (!strong) return null;
  const intensity = HEADLIGHT.intensity;
  return (
    <>
      {[1, -1].map((side) => (
        <spotLight
          key={side}
          ref={side === 1 ? left : right}
          position={[side * HEADLIGHT.x, HEADLIGHT.y, halfLength - 0.1]}
          angle={HEADLIGHT.angle}
          penumbra={HEADLIGHT.penumbra}
          intensity={intensity}
          distance={HEADLIGHT.reach * 2}
          decay={2}
          color="#fff1d0"
        />
      ))}
    </>
  );
}

/**
 * Atölyedeki build'i fizikli araca çevirir: Rapier gövdesi, kamera, efektler, ses, HUD ve tur zamanı.
 * Görsel (CarRig) atölyeyle aynıdır; tekerlekler fizikten gelen pozlarla hareket eder.
 */
export function DriveCar({
  track,
  snapshotRef,
  carGroupRef,
}: {
  track: Track;
  snapshotRef: RefObject<VehicleSnapshot | null>;
  /** Şasiyi izleyen kök grup (kamera ve gölge ışığı bunu okur) */
  carGroupRef: RefObject<Group | null>;
}) {
  const build = useBuildStore((s) => s.build);
  const car = getCar(build.carId);
  const timeOfDay = useDriveStore((s) => s.timeOfDay);
  const paused = useDriveStore((s) => s.paused);
  const restartTick = useDriveStore((s) => s.restartTick);
  const respawnTick = useDriveStore((s) => s.respawnTick);

  const physics = useRef<VehiclePhysics | null>(null);
  const [restHeight, setRestHeight] = useState<number | null>(null);
  const rig = useRef<Group>(null);
  const poses = useRef<WheelPose[]>(
    Array.from({ length: 4 }, () => ({ dy: 0, steer: 0, spin: 0 })),
  );
  const input = useRef<InputSource | null>(null);
  const audio = useRef<EngineAudio | null>(null);
  const lap = useRef<LapState>(initialLap());
  const acc = useRef(0);
  const hudClock = useRef(0);
  const supercharged = build.parts.engine === 'blower_v8';
  const exhaust = build.parts.exhaust ?? 'rear_dual';

  // Fizik dünyası: build (duruş, lastik, performans...) değişince yeniden kurulur
  useEffect(() => {
    let cancelled = false;
    let created: VehiclePhysics | null = null;
    void loadRapier().then((R) => {
      if (cancelled) return;
      const spec = deriveVehicleSpec(build, car.manifest, car.parts, car.driving);
      created = VehiclePhysics.create(R, spec, track);
      physics.current = created;
      lap.current = initialLap();
      setRestHeight(created.restHeight);
      useDriveStore.getState().setReady(true);
    });
    return () => {
      cancelled = true;
      physics.current = null;
      created?.dispose();
      useDriveStore.getState().setReady(false);
    };
  }, [build, car, track]);

  useEffect(() => {
    const source = createInputSource();
    input.current = source;
    const wake = () => audio.current?.resume();
    window.addEventListener('keydown', wake);
    window.addEventListener('pointerdown', wake);
    if (import.meta.env.DEV) {
      const dbg: DriveDebug = { input: source, physics: null };
      Object.defineProperty(dbg, 'physics', { get: () => physics.current });
      Object.assign(window, { __muscleGarageDrive: dbg });
    }
    return () => {
      window.removeEventListener('keydown', wake);
      window.removeEventListener('pointerdown', wake);
      source.dispose();
      input.current = null;
    };
  }, []);

  useEffect(() => {
    const a = new EngineAudio(exhaust);
    a.start();
    audio.current = a;
    return () => {
      a.stop();
      audio.current = null;
    };
  }, [exhaust]);

  useEffect(() => {
    if (restartTick === 0) return;
    physics.current?.reset(null);
    lap.current = { ...initialLap(), bestLap: lap.current.bestLap, lastLap: lap.current.lastLap };
  }, [restartTick]);
  useEffect(() => {
    if (respawnTick > 0) physics.current?.resetOnTrack();
  }, [respawnTick]);

  useFrame((_, delta) => {
    const ph = physics.current;
    const group = carGroupRef.current;
    if (!ph || !group) return;
    const store = useDriveStore.getState();

    if (!store.paused) {
      acc.current += Math.min(delta, 0.1);
      let steps = 0;
      const raw = input.current?.read() ?? { throttle: 0, brake: 0, steer: 0, handbrake: false };
      const prev = snapshotRef.current;
      const drive = prev
        ? applyAssists(
            raw,
            {
              forwardSpeed: prev.forwardSpeed,
              lateralSpeed: prev.lateralSpeed,
              slipSpeed: prev.slipSpeed,
            },
            DEFAULT_ASSISTS,
          )
        : raw;
      while (acc.current >= PHYSICS_STEP && steps < MAX_STEPS_PER_FRAME) {
        ph.step(PHYSICS_STEP, drive);
        acc.current -= PHYSICS_STEP;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) acc.current = 0;
    }

    const snap = ph.snapshot();
    snapshotRef.current = snap;
    group.position.set(...snap.position);
    group.quaternion.set(...snap.quaternion);

    snap.wheels.forEach((w, i) => {
      const pose = poses.current[i];
      if (!pose) return;
      pose.dy = (ph.restSuspension[i] ?? 0) - w.suspensionLength;
      pose.steer = w.steer;
      pose.spin = w.rotation;
    });

    if (!store.paused) lap.current = updateLap(lap.current, track, snap.trackS, ph.time);

    audio.current?.update({
      rpm: snap.rpm,
      throttle: snap.throttle,
      speed: snap.speed,
      slip: Math.max(...snap.wheels.map((w) => w.slip)),
      supercharged,
      volume: useAudioStore.getState().volume,
      paused: store.paused,
    });

    hudClock.current += delta;
    if (hudClock.current >= HUD_INTERVAL) {
      hudClock.current = 0;
      tmpQuat.set(...snap.quaternion);
      tmpForward.set(0, 0, 1).applyQuaternion(tmpQuat);
      store.setHud({
        speedKmh: Math.abs(snap.forwardSpeed) * 3.6,
        rpm: snap.rpm,
        redlineRpm: ph.spec.engine.redlineRpm,
        gear: snap.gear,
        reverse: snap.reverse,
        lap: lap.current,
        currentLap: lap.current.running ? ph.time - lap.current.lapStartTime : null,
        x: snap.position[0],
        z: snap.position[2],
        heading: Math.atan2(tmpForward.x, tmpForward.z),
        offTrack: snap.surface === 'grass',
      });
    }
  });

  const ready = restHeight !== null;
  const halfLength = car.body.halfLength;
  return (
    <>
      <group ref={carGroupRef}>
        {ready && (
          <group ref={rig} position-y={-restHeight}>
            <CarRig drive={{ poses }} />
            <Headlights rigRef={rig} halfLength={halfLength} strong={timeOfDay === 'night'} />
          </group>
        )}
      </group>
      {ready && (
        <>
          <DriveCamera
            carRef={carGroupRef}
            snapshotRef={snapshotRef}
            restHeight={restHeight}
            halfLength={halfLength}
          />
          <VehicleEffects
            snapshotRef={snapshotRef}
            rigRef={rig}
            car={car}
            parts={build.parts}
            paused={paused}
          />
        </>
      )}
    </>
  );
}
