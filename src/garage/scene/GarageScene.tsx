import { CarRig } from '../../car/CarRig';
import { GarageCamera } from '../camera/GarageCamera';
import { FpsProbe } from '../fx/FpsProbe';
import { PostFX } from '../fx/PostFX';
import { GarageEnvironment } from './GarageEnvironment';
import { GarageFloor } from './GarageFloor';
import { GarageLights } from './GarageLights';
import { GarageRoom } from './GarageRoom';
import { Turntable } from './Turntable';
import { TurntableInlay } from './TurntableInlay';
import { sceneConfig } from './sceneConfig';

export function GarageScene() {
  const { background, fog } = sceneConfig;
  return (
    <>
      <color attach="background" args={[background]} />
      <fogExp2 attach="fog" args={[fog.color, fog.density]} />
      <GarageEnvironment />
      <GarageLights />
      <GarageRoom />
      <GarageFloor />
      <Turntable>
        <TurntableInlay />
        <CarRig />
      </Turntable>
      <GarageCamera />
      <PostFX />
      <FpsProbe />
    </>
  );
}
