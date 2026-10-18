import { describe, expect, it } from 'vitest';
import {
  qualityPresets,
  QUALITY_LEVELS,
  sanitizeGraphics,
  DEFAULT_QUALITY,
  DEFAULT_TONE_MAPPING,
} from '../../core/store/graphicsStore';
import { sceneConfig } from '../scene/sceneConfig';
import { createGradeLUT, gradeColor, NEUTRAL_GRADE } from './colorGrade';

describe('renk düzenleme (LUT)', () => {
  it('nötr parametreler rengi değiştirmez', () => {
    for (const c of [
      [0, 0, 0],
      [1, 1, 1],
      [0.2, 0.5, 0.8],
    ] as [number, number, number][])
      gradeColor(c, NEUTRAL_GRADE).forEach((v, i) => expect(v).toBeCloseTo(c[i] as number, 6));
  });

  it('atölye tonu gölgeleri soğutur, parlak alanları ısıtır', () => {
    const g = sceneConfig.post.grade;
    const [sr, , sb] = gradeColor([0.08, 0.08, 0.08], g);
    const [hr, , hb] = gradeColor([0.85, 0.85, 0.85], g);
    expect(sb).toBeGreaterThan(sr);
    expect(hr).toBeGreaterThan(hb);
  });

  it('LUT float, 0..1 aralığında ve doğru boyutta', () => {
    const size = 8;
    const lut = createGradeLUT(sceneConfig.post.grade, size);
    expect(lut).toBeInstanceOf(Float32Array);
    expect(lut.length).toBe(size ** 3 * 4);
    expect(Math.min(...lut)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...lut)).toBeLessThanOrEqual(1);
  });

  it('nötr LUT birim dönüşümdür (r en hızlı eksen)', () => {
    const size = 4;
    const lut = createGradeLUT(NEUTRAL_GRADE, size);
    const at = (r: number, g: number, b: number) => {
      const i = ((b * size + g) * size + r) * 4;
      return [lut[i], lut[i + 1], lut[i + 2]];
    };
    expect(at(3, 0, 0)[0]).toBeCloseTo(1);
    expect(at(0, 3, 0)[1]).toBeCloseTo(1);
    expect(at(0, 0, 3)[2]).toBeCloseTo(1);
    expect(at(1, 2, 0)).toEqual([expect.closeTo(1 / 3), expect.closeTo(2 / 3), 0]);
  });
});

describe('grafik kalite ayarları', () => {
  it('her seviye tanımlı ve maliyet seviyeyle artar', () => {
    for (const level of QUALITY_LEVELS) expect(qualityPresets[level]).toBeDefined();
    const cost = (l: (typeof QUALITY_LEVELS)[number]) => {
      const p = qualityPresets[l];
      return (
        p.dpr * 10 +
        (p.shadows ? p.shadowMapSize / 512 : 0) +
        (p.floorReflection ? p.reflectorResolution / 256 : 0) +
        (p.ao ? 4 : 0) +
        (p.bloom ? 2 : 0) +
        (p.volumetric ? 1 : 0)
      );
    };
    const costs = QUALITY_LEVELS.map(cost);
    expect([...costs].sort((a, b) => a - b)).toEqual(costs);
  });

  it('kayıtlı ayar bozuksa varsayılanlara döner', () => {
    expect(sanitizeGraphics({ quality: 'insane', toneMapping: 'filmic', showFps: 'evet' })).toEqual(
      {
        quality: DEFAULT_QUALITY,
        toneMapping: DEFAULT_TONE_MAPPING,
        showFps: true,
        autoQuality: true,
      },
    );
    expect(sanitizeGraphics({ quality: 'low', toneMapping: 'aces', showFps: false })).toEqual({
      quality: 'low',
      toneMapping: 'aces',
      showFps: false,
      autoQuality: true,
    });
  });
});
