import { CarRig } from '../../car/CarRig';
import { GarageCamera } from '../camera/GarageCamera';
import { GarageEnvironment } from './GarageEnvironment';
import { GarageFloor } from './GarageFloor';
import { Turntable } from './Turntable';
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
      <Turntable>
        <CarRig />
      </Turntable>
      <GarageFloor />
      <GarageCamera />
    </>
  );
}
