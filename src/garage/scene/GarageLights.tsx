import { useEffect, useMemo } from 'react';
import { SpotLight } from '@react-three/drei';
import { Object3D } from 'three';
import { useQualityPreset } from '../../core/store/graphicsStore';
import { sceneConfig } from './sceneConfig';

/**
 * Doğrudan ışıklar: tepe ana spot (gölge), hacimli huzmeli tavan spotları, sıcak yan dolgu
 * ve soğuk arka kontur. Yansımalar ortam haritasından gelir (GarageEnvironment).
 */
export function GarageLights() {
  const l = sceneConfig.lights;
  const q = useQualityPreset();
  const keyTarget = useMemo(() => new Object3D(), []);
  useEffect(() => {
    keyTarget.position.set(...l.key.target);
    keyTarget.updateMatrixWorld();
  }, [keyTarget, l.key.target]);

  return (
    <group>
      <ambientLight intensity={l.ambient} />
      <hemisphereLight args={[l.hemisphere.sky, l.hemisphere.ground, l.hemisphere.intensity]} />
      {l.wallWash.lights.map((w, i) => (
        <BeamLight
          key={`wash-${i}`}
          position={w.position}
          target={w.target}
          color={l.wallWash.color}
          intensity={l.wallWash.intensity}
          cone={l.wallWash}
        />
      ))}
      <primitive object={keyTarget} />
      <spotLight
        // Gölge haritası boyutu değişince ışık yeniden oluşturulsun.
        key={q.shadows ? q.shadowMapSize : 'no-shadow'}
        position={l.key.position}
        target={keyTarget}
        color={l.key.color}
        intensity={l.key.intensity}
        angle={l.key.angle}
        penumbra={l.key.penumbra}
        distance={l.key.distance}
        castShadow={q.shadows}
        shadow-mapSize={[q.shadowMapSize, q.shadowMapSize]}
        shadow-bias={l.key.shadowBias}
      />
      {l.beams.map((b, i) =>
        q.volumetric ? (
          <SpotLight
            key={i}
            position={b.position}
            target-position={b.target}
            color={b.color}
            intensity={b.intensity}
            angle={l.beamCone.angle}
            penumbra={l.beamCone.penumbra}
            distance={l.beamCone.distance}
            attenuation={l.beamCone.attenuation}
            anglePower={l.beamCone.anglePower}
            opacity={l.beamCone.opacity}
            volumetric
          />
        ) : (
          <BeamLight
            key={i}
            position={b.position}
            target={b.target}
            color={b.color}
            intensity={b.intensity}
          />
        ),
      )}
      <pointLight
        position={l.warmSide.position}
        color={l.warmSide.color}
        intensity={l.warmSide.intensity}
        distance={l.warmSide.distance}
      />
      <pointLight
        position={l.coolRim.position}
        color={l.coolRim.color}
        intensity={l.coolRim.intensity}
        distance={l.coolRim.distance}
      />
    </group>
  );
}

/** Hacim efekti olmadan aynı tavan spotu (düşük kalite). */
function BeamLight({
  position,
  target,
  color,
  intensity,
  cone,
}: {
  position: [number, number, number];
  target: [number, number, number];
  color: string;
  intensity: number;
  cone?: { angle: number; penumbra: number; distance: number };
}) {
  const t = useMemo(() => new Object3D(), []);
  useEffect(() => {
    t.position.set(...target);
    t.updateMatrixWorld();
  }, [t, target]);
  const c = cone ?? sceneConfig.lights.beamCone;
  return (
    <>
      <primitive object={t} />
      <spotLight
        position={position}
        target={t}
        color={color}
        intensity={intensity}
        angle={c.angle}
        penumbra={c.penumbra}
        distance={c.distance}
      />
    </>
  );
}
