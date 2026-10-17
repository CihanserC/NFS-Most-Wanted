import { MeshReflectorMaterial } from '@react-three/drei';
import { sceneConfig } from './sceneConfig';

const FLAT = -Math.PI / 2;

export function GarageFloor() {
  const f = sceneConfig.floor;
  return (
    <mesh rotation-x={FLAT} receiveShadow>
      <planeGeometry args={[f.size, f.size]} />
      <MeshReflectorMaterial
        color={f.color}
        roughness={f.roughness}
        metalness={f.metalness}
        mirror={f.mirror}
        blur={f.blur}
        mixBlur={f.mixBlur}
        mixStrength={f.mixStrength}
        resolution={f.resolution}
        depthScale={f.depthScale}
      />
    </mesh>
  );
}
