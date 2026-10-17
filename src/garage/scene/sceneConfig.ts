import { v3, type Vec3 } from '../../core/math/tuples';
import type { GradeParams } from '../fx/colorGrade';

/** Tavandaki şerit armatürlerin z konumları: hem görünür armatür hem ortam haritası ışığı. */
const CEILING_STRIPS_Z = [-2.4, -0.8, 0.8, 2.4];
const CEILING_STRIP_Y = 5.2;
/** Araç çevresindeki dikey LED stantları (z) ve |x| konumu */
const LIGHT_STANDS_Z = [-4, -1.5, 1.5, 4];
const LIGHT_STAND_X = 7;
const LIGHT_STAND = { height: 3.2, centerY: 1.9 };

const WARM = '#ff7a1f';
const COOL = '#2fd8ff';

/** Atölye sahnesi ayarları. Sahne kodunda sihirli sayı olmaması için tek kaynak. */
export const sceneConfig = {
  background: '#07080a',
  /** Üstel sis: derinlikte pus, ışık huzmelerine hacim hissi */
  fog: { color: '#07080a', density: 0.045 },
  camera: { fov: 40, near: 0.05, far: 80 },
  orbit: {
    minDistance: 1.6,
    /** Oda duvarlarının dışına çıkmasın */
    maxDistance: 9,
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
    /** Zemine gömülü (flush) döner tabla */
    radius: 3,
    ringWidth: 0.05,
    ringColor: WARM,
    ringIntensity: 4,
    discOpacity: 0.45,
    seams: 12,
  },
  /** Araç altındaki yumuşak gölge (temas hissi) */
  carShadow: { width: 2.3, length: 5.2, opacity: 0.85 },
  room: {
    halfWidth: 12,
    halfDepth: 11,
    height: 7,
    wallBrick: { repeat: [6, 2] as [number, number], color: '#6b3a2c' },
    wallMetal: { repeat: [10, 1] as [number, number], color: '#3a4048' },
    ceilingColor: '#0b0c0e',
    beams: { count: 6, size: v3(0.35, 0.5, 22), color: '#1a1c20' },
    /** Yan duvarlarda alçak LED şeritler (sol sıcak, sağ soğuk) */
    wallStrips: { y: 1.1, height: 0.06, length: 18, intensity: 3 },
    warm: WARM,
    cool: COOL,
  },
  floor: {
    size: 26,
    textureRepeat: 7,
    color: '#5b5d61',
    roughness: 0.55,
    metalness: 0.2,
    mirror: 0.75,
    blur: [400, 100] as [number, number],
    mixBlur: 1.1,
    mixStrength: 6,
    depthScale: 1.2,
    minDepthThreshold: 0.4,
    maxDepthThreshold: 1.4,
  },
  fixtures: {
    ceilingStrip: { y: CEILING_STRIP_Y, length: 7, width: 0.42, depth: 0.12, intensity: 6 },
    standLight: { radius: 0.04, intensity: 5, poleRadius: 0.025, baseRadius: 0.25 },
  },
  lights: {
    ambient: 0.15,
    /** Odayı karanlıkta kaybetmeyen çok sönük gök/zemin dolgusu */
    hemisphere: { sky: '#3a3f4a', ground: '#140f0a', intensity: 0.35 },
    /** Tuğla duvarı yalayan tavan spotları (duvar dokusu ve derinlik) */
    wallWash: {
      lights: [
        { position: v3(-5.5, 6.6, -8.2), target: v3(-5.5, 1.5, -11) },
        { position: v3(5.5, 6.6, -8.2), target: v3(5.5, 1.5, -11) },
        { position: v3(0, 6.6, -8.4), target: v3(0, 1.2, -11) },
      ],
      color: '#ffd9b0',
      intensity: 70,
      angle: 0.7,
      penumbra: 0.9,
      distance: 12,
    },
    key: {
      position: v3(0, 6.4, 0.4),
      target: v3(0, 0, 0),
      color: '#fff4e6',
      intensity: 180,
      angle: 0.62,
      penumbra: 0.75,
      distance: 14,
      shadowBias: -0.0004,
    },
    /** Hacimli (volumetric) huzme veren tavan spotları */
    beams: [
      { position: v3(-2.8, 6.6, -1.2), target: v3(-1.2, 0, -0.6), color: '#fff1dc', intensity: 40 },
      { position: v3(2.8, 6.6, 1.6), target: v3(1.2, 0, 0.8), color: '#e8f4ff', intensity: 35 },
    ],
    beamCone: {
      angle: 0.4,
      penumbra: 0.8,
      distance: 9,
      attenuation: 6,
      anglePower: 5,
      opacity: 0.12,
    },
    warmSide: { position: v3(-6, 1.4, 1.5), color: WARM, intensity: 14, distance: 12 },
    coolRim: { position: v3(5.5, 2.2, -4), color: COOL, intensity: 10, distance: 12 },
  },
  neon: {
    /** Arka duvardaki neon tabelanın merkezi */
    position: v3(0, 3.6, -10.9),
    tubeRadius: 0.035,
    intensity: 6,
    warm: WARM,
    cool: COOL,
  },
  props: {
    toolChest: { position: v3(-8.5, 0, -9.4), size: v3(1.6, 1.1, 0.6), color: '#9a1410' },
    tireStacks: [v3(9.2, 0, -8.6), v3(10.2, 0, -7.2)] as Vec3[],
    drums: [v3(-10.6, 0, -6.2), v3(-10.6, 0, -5.4), v3(-9.8, 0, -5.8)] as Vec3[],
    drumColor: '#1f4d6b',
    bench: { position: v3(7.5, 0, -10.2), size: v3(3.2, 0.95, 0.8), color: '#3b3226' },
  },
  /**
   * Prosedürel ortam haritası: odadaki görünür armatürlerle aynı konumlarda ışık panelleri,
   * böylece boya/krom yansımaları sahnedeki ışıklarla tutarlı.
   * rotation: [x, y, z] radyan; panelin ön yüzü +Z'ye bakar.
   */
  environment: {
    resolution: 256,
    lightformers: [
      ...CEILING_STRIPS_Z.map((z) => ({
        position: v3(0, CEILING_STRIP_Y, z),
        scale: v3(7, 0.42, 1),
        rotation: v3(Math.PI / 2, 0, 0),
        intensity: 7,
        color: '#ffffff',
      })),
      ...LIGHT_STANDS_Z.flatMap((z) =>
        [1, -1].map((side) => ({
          position: v3(side * LIGHT_STAND_X, LIGHT_STAND.centerY, z),
          scale: v3(0.3, LIGHT_STAND.height, 1),
          rotation: v3(0, (-side * Math.PI) / 2, 0),
          intensity: 2.4,
          color: '#ffffff',
        })),
      ),
      {
        position: v3(-11, 1.1, 0),
        scale: v3(18, 0.5, 1),
        rotation: v3(0, Math.PI / 2, 0),
        intensity: 3,
        color: WARM,
      },
      {
        position: v3(11, 1.1, 0),
        scale: v3(18, 0.5, 1),
        rotation: v3(0, -Math.PI / 2, 0),
        intensity: 2.2,
        color: COOL,
      },
      {
        position: v3(0, 3.6, -10.5),
        scale: v3(5, 1.5, 1),
        rotation: v3(0, 0, 0),
        intensity: 1.5,
        color: WARM,
      },
      {
        position: v3(0, 2, -11),
        scale: v3(22, 5, 1),
        rotation: v3(0, 0, 0),
        intensity: 0.25,
        color: '#c9ccd4',
      },
      {
        position: v3(0, 2, 11),
        scale: v3(22, 5, 1),
        rotation: v3(0, Math.PI, 0),
        intensity: 0.3,
        color: '#c9ccd4',
      },
      {
        position: v3(0, -1, 0),
        scale: v3(14, 14, 1),
        rotation: v3(-Math.PI / 2, 0, 0),
        intensity: 0.2,
        color: '#8a8070',
      },
    ],
  },
  lightStands: { z: LIGHT_STANDS_Z, x: LIGHT_STAND_X, ...LIGHT_STAND },
  ceilingStripsZ: CEILING_STRIPS_Z,
  post: {
    bloom: { intensity: 0.75, threshold: 0.82, smoothing: 0.25, radius: 0.7 },
    vignette: { offset: 0.28, darkness: 0.72 },
    ao: { radius: 0.7, distanceFalloff: 0.6, intensity: 2.2, color: '#000000' },
    lutSize: 32,
    grade: {
      shadowTint: [0.32, 0.55, 0.62],
      shadowStrength: 0.28,
      highlightTint: [0.72, 0.52, 0.3],
      highlightStrength: 0.22,
      contrast: 1.08,
      saturation: 1.06,
      lift: 0.012,
    } satisfies GradeParams,
  },
};
