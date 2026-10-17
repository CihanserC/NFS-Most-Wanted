import { v2, v3 } from '../../core/math/tuples';

/** Faz 0 atölye sahnesi ayarları. Sahne kodunda sihirli sayı olmaması için tek kaynak. */
export const sceneConfig = {
  background: '#050506',
  fog: { color: '#050506', near: 8, far: 30 },
  camera: { position: v3(4.5, 1.4, 5.5), fov: 40 },
  orbit: {
    target: v3(0, 0.6, 0),
    minDistance: 3,
    maxDistance: 14,
    /** Kamera zemin altına inmesin (radyan). */
    maxPolarAngle: Math.PI / 2 - 0.05,
    dampingFactor: 0.08,
  },
  floor: {
    size: 60,
    color: '#202024',
    roughness: 0.4,
    metalness: 0.4,
    mirror: 0.9,
    blur: v2(300, 80),
    mixBlur: 0.8,
    mixStrength: 12,
    resolution: 1024,
    depthScale: 1,
  },
  /** Placeholder test kutusu (Faz 1'de araçla değişecek). */
  testBox: {
    size: v3(1.6, 1.0, 1.6),
    color: '#d24a12',
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    roughness: 0.35,
    metalness: 0.3,
    turntableSpeed: 0.25,
  },
  lights: {
    ambient: 0.4,
    key: { position: v3(0, 6, 0), intensity: 40, angle: 0.6, penumbra: 0.8 },
    warmSide: { position: v3(-5, 1.5, 2), color: '#ff9a4a', intensity: 5 },
  },
  /** Prosedürel ortam haritası (HDRI yerine; gerçek HDRI Faz 4'te). */
  environment: {
    resolution: 256,
    softboxes: [
      { position: v3(0, 5, -2), scale: v3(6, 0.6, 1), intensity: 8 },
      { position: v3(0, 5, 0), scale: v3(6, 0.6, 1), intensity: 8 },
      { position: v3(0, 5, 2), scale: v3(6, 0.6, 1), intensity: 8 },
    ],
    warm: { position: v3(-6, 1, 0), scale: v3(3, 2, 1), intensity: 4, color: '#ff8a3a' },
    cool: { position: v3(6, 1, 0), scale: v3(3, 2, 1), intensity: 3, color: '#5a8cff' },
  },
};
