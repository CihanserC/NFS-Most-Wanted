import { OrbitControls } from '@react-three/drei';
import { sceneConfig } from '../scene/sceneConfig';

export function GarageCamera() {
  const o = sceneConfig.orbit;
  return (
    <OrbitControls
      makeDefault
      target={o.target}
      minDistance={o.minDistance}
      maxDistance={o.maxDistance}
      maxPolarAngle={o.maxPolarAngle}
      enableDamping
      dampingFactor={o.dampingFactor}
      enablePan={false}
    />
  );
}
