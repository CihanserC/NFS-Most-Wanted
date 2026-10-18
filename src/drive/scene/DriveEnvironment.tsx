import { useRef, type RefObject } from 'react';
import { Environment, Lightformer, Sky, Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Vector3, type DirectionalLight, type Group } from 'three';
import { useQualityPreset } from '../../core/store/graphicsStore';
import type { TimeOfDay } from '../../core/store/driveStore';
import { driveLighting } from './driveLighting';

const SHADOW_RANGE = 45;
const SUN_DISTANCE = 120;

/** Gökyüzü, güneş/ay, sis ve ortam yansıması. Güneş, gölge kutusu aracı izler. */
export function DriveEnvironment({
  timeOfDay,
  target,
}: {
  timeOfDay: TimeOfDay;
  /** Aracın dünya konumunu veren grup (gölge kamerası onu izler) */
  target: RefObject<Group | null>;
}) {
  const q = useQualityPreset();
  const l = driveLighting[timeOfDay];
  const sun = useRef<DirectionalLight>(null);
  const pos = new Vector3();

  useFrame(() => {
    const light = sun.current;
    const t = target.current;
    if (!light || !t) return;
    t.getWorldPosition(pos);
    light.target.position.copy(pos);
    light.position.copy(pos).addScaledVector(l.sunDirection, SUN_DISTANCE);
    light.target.updateMatrixWorld();
  });

  return (
    <>
      <color attach="background" args={[l.background]} />
      <fog attach="fog" args={[l.fog.color, l.fog.near, l.fog.far]} />
      {timeOfDay === 'sunset' ? (
        <Sky
          distance={4500}
          sunPosition={l.sunDirection.clone().multiplyScalar(1000).toArray()}
          turbidity={9}
          rayleigh={2.4}
          mieCoefficient={0.012}
          mieDirectionalG={0.9}
        />
      ) : (
        <Stars radius={600} depth={60} count={2500} factor={5} saturation={0} fade speed={0} />
      )}
      <hemisphereLight args={[l.hemi.sky, l.hemi.ground, l.hemi.intensity]} />
      <directionalLight
        ref={sun}
        color={l.sunColor}
        intensity={l.sunIntensity}
        castShadow={q.shadows}
        shadow-mapSize={[q.shadowMapSize, q.shadowMapSize]}
        shadow-camera-left={-SHADOW_RANGE}
        shadow-camera-right={SHADOW_RANGE}
        shadow-camera-top={SHADOW_RANGE}
        shadow-camera-bottom={-SHADOW_RANGE}
        shadow-camera-near={1}
        shadow-camera-far={SUN_DISTANCE * 2}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <Environment
        key={timeOfDay}
        frames={1}
        resolution={128}
        environmentIntensity={l.envIntensity}
      >
        {timeOfDay === 'sunset' ? (
          <>
            <Lightformer
              form="rect"
              intensity={9}
              color="#ffb36b"
              position={l.sunDirection.clone().multiplyScalar(30).toArray()}
              scale={[18, 8, 1]}
              target={[0, 0, 0]}
            />
            <Lightformer
              form="rect"
              intensity={1.6}
              color="#9fc4ff"
              position={[0, 20, 0]}
              rotation-x={Math.PI / 2}
              scale={[40, 40, 1]}
            />
            <Lightformer
              form="rect"
              intensity={0.8}
              color="#7a6a50"
              position={[0, -6, 0]}
              rotation-x={-Math.PI / 2}
              scale={[40, 40, 1]}
            />
          </>
        ) : (
          <>
            <Lightformer
              form="rect"
              intensity={1.4}
              color="#7f9cff"
              position={l.sunDirection.clone().multiplyScalar(30).toArray()}
              scale={[14, 6, 1]}
              target={[0, 0, 0]}
            />
            <Lightformer
              form="rect"
              intensity={0.4}
              color="#1b2650"
              position={[0, 20, 0]}
              rotation-x={Math.PI / 2}
              scale={[40, 40, 1]}
            />
          </>
        )}
      </Environment>
    </>
  );
}
