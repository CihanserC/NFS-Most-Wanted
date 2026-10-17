import { Canvas } from '@react-three/fiber';
import { GarageScene } from '../garage/scene/GarageScene';
import { GarageMenu } from '../garage/ui/GarageMenu';
import { TopBar } from '../garage/ui/TopBar';
import { DEFAULT_CAR_ID, getCar } from '../data/cars';
import { sceneConfig } from '../garage/scene/sceneConfig';
import { useQualityPreset } from '../core/store/graphicsStore';

const { manifest } = getCar(DEFAULT_CAR_ID);
const initialCamera = manifest.cameraPresets[manifest.defaultCamera];

export function App() {
  const q = useQualityPreset();
  const { fov, near, far } = sceneConfig.camera;
  return (
    <>
      <Canvas
        // Gölge türü değişince renderer yeniden kurulsun.
        key={q.shadows ? 'shadows' : 'no-shadows'}
        shadows={q.shadows ? 'soft' : false}
        dpr={[1, q.dpr]}
        // Ton eşleme post-processing'de yapılır (AgX/ACES seçimi).
        flat
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ position: initialCamera?.position, fov, near, far }}
      >
        <GarageScene />
      </Canvas>
      <GarageMenu />
      <TopBar />
    </>
  );
}
