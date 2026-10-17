import { Canvas } from '@react-three/fiber';
import { GarageScene } from '../garage/scene/GarageScene';
import { useAppStore } from '../core/store/appStore';
import { sceneConfig } from '../garage/scene/sceneConfig';

export function App() {
  const turntable = useAppStore((s) => s.turntable);
  const toggleTurntable = useAppStore((s) => s.toggleTurntable);
  const { position, fov } = sceneConfig.camera;

  return (
    <>
      <Canvas shadows dpr={[1, 2]} camera={{ position, fov }}>
        <GarageScene />
      </Canvas>
      <button
        type="button"
        onClick={toggleTurntable}
        style={{ position: 'absolute', left: 16, bottom: 16 }}
      >
        Döner tabla: {turntable ? 'Açık' : 'Kapalı'}
      </button>
    </>
  );
}
