import { lazy, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { GarageScene } from '../garage/scene/GarageScene';
import { GarageMenu } from '../garage/ui/GarageMenu';
import { TopBar } from '../garage/ui/TopBar';
import { DriveOverlay } from '../drive/ui/DriveOverlay';
import { DEFAULT_CAR_ID, getCar } from '../data/cars';
import { sceneConfig } from '../garage/scene/sceneConfig';
import { useAppStore } from '../core/store/appStore';
import { useQualityPreset } from '../core/store/graphicsStore';

// Rapier (WASM) ve pist kodu yalnızca test sürüşüne girilince yüklenir.
const DriveScene = lazy(() =>
  import('../drive/scene/DriveScene').then((m) => ({ default: m.DriveScene })),
);

const { manifest } = getCar(DEFAULT_CAR_ID);
const initialCamera = manifest.cameraPresets[manifest.defaultCamera];

export function App() {
  const q = useQualityPreset();
  const mode = useAppStore((s) => s.mode);
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
        <Suspense fallback={null}>{mode === 'garage' ? <GarageScene /> : <DriveScene />}</Suspense>
      </Canvas>
      {mode === 'garage' ? (
        <>
          <GarageMenu />
          <TopBar />
        </>
      ) : (
        <DriveOverlay />
      )}
    </>
  );
}
