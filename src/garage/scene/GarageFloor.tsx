import { MeshReflectorMaterial } from '@react-three/drei';
import { useQualityPreset } from '../../core/store/graphicsStore';
import { concreteTextures } from './garageTextures';
import { sceneConfig } from './sceneConfig';

const FLAT = -Math.PI / 2;

/** Yansımalı beton zemin. Düşük kalitede yansıma kapalı (sadece ortam haritası). */
export function GarageFloor() {
  const f = sceneConfig.floor;
  const q = useQualityPreset();
  const { map, roughnessMap } = concreteTextures(f.textureRepeat);

  return (
    <mesh rotation-x={FLAT} receiveShadow>
      <planeGeometry args={[f.size, f.size]} />
      {q.floorReflection ? (
        <MeshReflectorMaterial
          // Çözünürlük değişince yansıma hedefi yeniden oluşturulsun.
          key={q.reflectorResolution}
          color={f.color}
          map={map}
          roughnessMap={roughnessMap}
          roughness={f.roughness}
          metalness={f.metalness}
          mirror={f.mirror}
          blur={f.blur}
          mixBlur={f.mixBlur}
          mixStrength={f.mixStrength}
          resolution={q.reflectorResolution}
          depthScale={f.depthScale}
          minDepthThreshold={f.minDepthThreshold}
          maxDepthThreshold={f.maxDepthThreshold}
        />
      ) : (
        <meshStandardMaterial
          color={f.color}
          map={map}
          roughnessMap={roughnessMap}
          roughness={f.roughness}
          metalness={f.metalness}
        />
      )}
    </mesh>
  );
}
