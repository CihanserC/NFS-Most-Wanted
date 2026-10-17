import { useEffect, useRef, type ComponentRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useAppStore } from '../../core/store/appStore';
import { useBuildStore } from '../../core/store/stores';
import { getCar } from '../../data/cars';
import { sceneConfig } from '../scene/sceneConfig';

type Transition = {
  fromPos: Vector3;
  fromTarget: Vector3;
  toPos: Vector3;
  toTarget: Vector3;
  t: number;
};

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Seçili slotun manifestteki kamera preset'ini döndürür (slot yoksa varsayılan). */
function usePresetId(): string {
  const slotId = useAppStore((s) => s.slotId);
  const paintZone = useAppStore((s) => s.paintZone);
  const carId = useBuildStore((s) => s.build.carId);
  const { manifest } = getCar(carId);
  if (paintZone) return manifest.paintZoneCameras?.[paintZone] ?? manifest.defaultCamera;
  return (slotId && manifest.slots[slotId]?.camera) || manifest.defaultCamera;
}

export function GarageCamera() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const carId = useBuildStore((s) => s.build.carId);
  const presetId = usePresetId();
  const transition = useRef<Transition | null>(null);
  const o = sceneConfig.orbit;

  useEffect(() => {
    const preset = getCar(carId).manifest.cameraPresets[presetId];
    const c = controls.current;
    if (!preset || !c) return;
    transition.current = {
      fromPos: camera.position.clone(),
      fromTarget: c.target.clone(),
      toPos: new Vector3(...preset.position),
      toTarget: new Vector3(...preset.target),
      t: 0,
    };
  }, [presetId, carId, camera]);

  useFrame((_, delta) => {
    const tr = transition.current;
    const c = controls.current;
    if (!tr || !c) return;
    tr.t = Math.min(1, tr.t + delta / sceneConfig.cameraTransition.durationSec);
    const k = easeInOutCubic(tr.t);
    camera.position.lerpVectors(tr.fromPos, tr.toPos, k);
    c.target.lerpVectors(tr.fromTarget, tr.toTarget, k);
    c.update();
    if (tr.t >= 1) transition.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      minDistance={o.minDistance}
      maxDistance={o.maxDistance}
      maxPolarAngle={o.maxPolarAngle}
      enableDamping
      dampingFactor={o.dampingFactor}
      enablePan={false}
      // Kullanıcı sürüklemeye başlarsa otomatik geçiş iptal edilir.
      onStart={() => {
        transition.current = null;
      }}
    />
  );
}
