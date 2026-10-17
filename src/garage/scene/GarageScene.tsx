import { GarageCamera } from '../camera/GarageCamera';
import { GarageEnvironment } from './GarageEnvironment';
import { GarageFloor } from './GarageFloor';
import { TestBox } from './TestBox';
import { sceneConfig } from './sceneConfig';

export function GarageScene() {
  const { background, fog, lights } = sceneConfig;
  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[fog.color, fog.near, fog.far]} />
      <GarageEnvironment />
      <ambientLight intensity={lights.ambient} />
      <spotLight
        position={lights.key.position}
        intensity={lights.key.intensity}
        angle={lights.key.angle}
        penumbra={lights.key.penumbra}
        castShadow
      />
      <pointLight
        position={lights.warmSide.position}
        color={lights.warmSide.color}
        intensity={lights.warmSide.intensity}
      />
      <TestBox />
      <GarageFloor />
      <GarageCamera />
    </>
  );
}
