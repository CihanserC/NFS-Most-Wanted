import { v2, v3 } from '../../core/math/tuples';

/** Atölye sahnesi ayarları. Sahne kodunda sihirli sayı olmaması için tek kaynak. */
export const sceneConfig = {
  background: '#050506',
  fog: { color: '#050506', near: 8, far: 30 },
  camera: { fov: 40 },
  orbit: {
    minDistance: 1.6,
    maxDistance: 14,
    /** Kamera zemin altına inmesin (radyan). */
    maxPolarAngle: Math.PI / 2 - 0.05,
    dampingFactor: 0.08,
  },
  /** Slot seçilince kameranın preset'e geçişi. */
  cameraTransition: { durationSec: 0.9 },
  turntable: {
    /** rad/sn */
    speed: 0.25,
    /** Slot seçilince aracın sıfır açıya dönüş hızı (damp lambda). */
    returnDamping: 4,
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
  lights: {
    ambient: 0.4,
    key: { position: v3(0, 6, 0), intensity: 40, angle: 0.6, penumbra: 0.8 },
    warmSide: { position: v3(-5, 1.5, 2), color: '#ff9a4a', intensity: 5 },
  },
  /**
   * Prosedürel ortam haritası (HDRI yerine; gerçek HDRI Faz 4'te). Krom ve vernik
   * yansımalarının okunabilmesi için araç etrafında farklı yönlerde ışık panelleri var.
   * rotation: [x, y, z] radyan; panelin ön yüzü +Z'ye bakar.
   */
  environment: {
    resolution: 256,
    lightformers: [
      // Tepe softbox şeritleri (boyada uzun parlak çizgiler)
      ...[-2.4, -0.8, 0.8, 2.4].map((z) => ({
        position: v3(0, 5, z),
        scale: v3(7, 0.5, 1),
        rotation: v3(Math.PI / 2, 0, 0),
        intensity: 7,
        color: '#ffffff',
      })),
      // Yan dikey şeritler (kapılarda dikey yansımalar)
      ...[-4, -1.5, 1.5, 4].flatMap((z) =>
        [1, -1].map((side) => ({
          position: v3(side * 7, 1.6, z),
          scale: v3(0.35, 3.2, 1),
          rotation: v3(0, (-side * Math.PI) / 2, 0),
          intensity: 2.2,
          color: '#ffffff',
        })),
      ),
      // Sıcak ve soğuk yan dolgu
      {
        position: v3(-6, 1, 0),
        scale: v3(4, 2, 1),
        rotation: v3(0, Math.PI / 2, 0),
        intensity: 3,
        color: '#ff8a3a',
      },
      {
        position: v3(6, 1, 0),
        scale: v3(4, 2, 1),
        rotation: v3(0, -Math.PI / 2, 0),
        intensity: 2,
        color: '#5a8cff',
      },
      // Ön/arka duvar: geniş, sönük gradyan
      {
        position: v3(0, 2, -9),
        scale: v3(16, 4, 1),
        rotation: v3(0, 0, 0),
        intensity: 0.5,
        color: '#c9ccd4',
      },
      {
        position: v3(0, 2, 9),
        scale: v3(16, 4, 1),
        rotation: v3(0, Math.PI, 0),
        intensity: 0.4,
        color: '#c9ccd4',
      },
      // Zeminden yansıyan sönük ışık (kromun alt yarısı simsiyah kalmasın)
      {
        position: v3(0, -1, 0),
        scale: v3(14, 14, 1),
        rotation: v3(-Math.PI / 2, 0, 0),
        intensity: 0.25,
        color: '#8a8070',
      },
    ],
  },
};
