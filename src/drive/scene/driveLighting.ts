import { Vector3 } from 'three';

/** Gün batımı / gece ayarları (sahne kodunda sihirli sayı olmasın). */
export const driveLighting = {
  sunset: {
    background: '#e8a36e',
    fog: { color: '#d99a72', near: 80, far: 1500 },
    sky: { horizon: '#f2b27c', zenith: '#4a7fc4', glow: '#ff9a4a' },
    sunDirection: new Vector3(-0.8, 0.22, 0.55).normalize(),
    sunColor: '#ffb06a',
    sunIntensity: 3.4,
    hemi: { sky: '#ffcfa0', ground: '#4a3a28', intensity: 0.7 },
    envIntensity: 1,
  },
  night: {
    background: '#070b16',
    fog: { color: '#080c18', near: 40, far: 800 },
    sky: { horizon: '#10182e', zenith: '#03060e', glow: '#3a4a8a' },
    sunDirection: new Vector3(0.5, 0.6, -0.6).normalize(),
    sunColor: '#8fa8ff',
    sunIntensity: 1.7,
    hemi: { sky: '#2a3a66', ground: '#0c1020', intensity: 1.1 },
    envIntensity: 0.8,
  },
} as const;
