import { Canvas } from '@react-three/fiber';
import { GarageScene } from '../garage/scene/GarageScene';
import { GarageMenu } from '../garage/ui/GarageMenu';
import { TopBar } from '../garage/ui/TopBar';
import { DEFAULT_CAR_ID, getCar } from '../data/cars';
import { sceneConfig } from '../garage/scene/sceneConfig';

const { manifest } = getCar(DEFAULT_CAR_ID);
const initialCamera = manifest.cameraPresets[manifest.defaultCamera];

export function App() {
  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: initialCamera?.position, fov: sceneConfig.camera.fov }}
      >
        <GarageScene />
      </Canvas>
      <GarageMenu />
      <TopBar />
    </>
  );
}
