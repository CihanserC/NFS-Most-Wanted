import { useEffect, useRef, type RefObject } from 'react';
import { useFrame, useStore } from '@react-three/fiber';
import { PerspectiveCamera, Quaternion, Vector3, type Group } from 'three';
import {
  DRIVE_CAMERAS,
  useDriveStore,
  type DriveCamera as Mode,
} from '../../core/store/driveStore';
import { sceneConfig } from '../../garage/scene/sceneConfig';
import type { VehicleSnapshot } from '../physics/VehiclePhysics';

/** Kamera ayarları: mesafe/yükseklik (m), bakış öne mesafesi, FOV (derece) */
const CAMERA_CONFIG: Record<
  Mode,
  {
    distance: number;
    height: number;
    lookAhead: number;
    lookHeight: number;
    fov: number;
    fovSpeed: number;
  }
> = {
  chase: { distance: 6.8, height: 2.3, lookAhead: 4, lookHeight: 1, fov: 58, fovSpeed: 14 },
  chase_low: { distance: 5.2, height: 1.15, lookAhead: 6, lookHeight: 0.8, fov: 62, fovSpeed: 14 },
  hood: { distance: 0, height: 0, lookAhead: 20, lookHeight: 0, fov: 72, fovSpeed: 8 },
  bumper: { distance: 0, height: 0, lookAhead: 20, lookHeight: 0, fov: 78, fovSpeed: 8 },
};
/** Kaput / tampon kamerası konumları, zemin hizalı araç uzayında (m) */
const MOUNTS = { hood: { y: 1.12, z: 0.55 }, bumper: { y: 0.42, zExtra: 0.25 } };
const TOP_SPEED_FOR_FOV = 70;
const FOLLOW_RATE = 6;
const YAW_RATE = 4;

/** Araç kamerası: `C` ile ardı sıra geçiş. Aracın konum/yönünü grup nesnesinden okur. */
export function DriveCamera({
  carRef,
  snapshotRef,
  restHeight,
  halfLength,
}: {
  carRef: RefObject<Group | null>;
  snapshotRef: RefObject<VehicleSnapshot | null>;
  /** Şasi orijininin dinlenmedeki zemin yüksekliği (m) */
  restHeight: number;
  halfLength: number;
}) {
  const store = useStore();
  const smoothed = useRef(new Vector3(0, 0, 1));
  const scratch = useRef({
    forward: new Vector3(),
    flat: new Vector3(),
    desired: new Vector3(),
    look: new Vector3(),
    quat: new Quaternion(),
  });
  const first = useRef(true);
  const index = useDriveStore((s) => s.cameraIndex);

  useEffect(() => {
    const camera = store.getState().camera as PerspectiveCamera;
    const { fov, near, far } = sceneConfig.camera;
    camera.near = 0.2;
    camera.far = 5000;
    camera.updateProjectionMatrix();
    return () => {
      // Atölyeye dönünce orijinal kamera ayarları
      camera.fov = fov;
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    };
  }, [store]);

  useEffect(() => {
    first.current = true;
  }, [index]);

  useFrame((state, delta) => {
    // Geliştirme: konsoldan kamerayı serbest bırakıp elle yerleştirmek için
    if (import.meta.env.DEV && Reflect.get(window, '__freeCamera') === true) return;
    const camera = state.camera as PerspectiveCamera;
    const g = carRef.current;
    if (!g) return;
    const { forward, flat, desired, look, quat } = scratch.current;
    const dt = Math.min(delta, 0.1);
    const mode = DRIVE_CAMERAS[index] as Mode;
    const cfg = CAMERA_CONFIG[mode];
    g.getWorldQuaternion(quat);
    forward.set(0, 0, 1).applyQuaternion(quat);
    flat.set(forward.x, 0, forward.z).normalize();
    const k = first.current ? 1 : 1 - Math.exp(-dt * YAW_RATE);
    smoothed.current.lerp(flat, k).normalize();
    const kf = first.current ? 1 : 1 - Math.exp(-dt * FOLLOW_RATE);
    const p = g.position;
    const speed = snapshotRef.current?.speed ?? 0;

    if (mode === 'hood' || mode === 'bumper') {
      const mount =
        mode === 'hood'
          ? { y: MOUNTS.hood.y - restHeight, z: MOUNTS.hood.z }
          : { y: MOUNTS.bumper.y - restHeight, z: halfLength + MOUNTS.bumper.zExtra };
      desired.set(0, mount.y, mount.z).applyQuaternion(quat).add(p);
      camera.position.copy(desired);
      look.copy(forward).multiplyScalar(cfg.lookAhead).add(desired);
    } else {
      desired
        .copy(smoothed.current)
        .multiplyScalar(-cfg.distance)
        .add(p)
        .setY(p.y - restHeight + cfg.height);
      camera.position.lerp(desired, kf);
      look
        .copy(smoothed.current)
        .multiplyScalar(cfg.lookAhead)
        .add(p)
        .setY(p.y - restHeight + cfg.lookHeight);
    }
    camera.lookAt(look);
    camera.fov = cfg.fov + cfg.fovSpeed * Math.min(1, speed / TOP_SPEED_FOR_FOV);
    camera.updateProjectionMatrix();
    first.current = false;
  });

  return null;
}
