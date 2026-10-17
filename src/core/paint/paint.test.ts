import { describe, expect, it } from 'vitest';
import { hexToHsv, hsvToHex, normalizeHex, rgbToHex, hexToRgb } from '../color/color';
import { paintPresets, paintPalette } from '../../data/paints';
import {
  DEFAULT_PAINT,
  PaintImportError,
  normalizePaintMap,
  parsePaintExport,
  sanitizePaint,
  serializePaintMap,
  validatePaint,
} from './paint';
import { resolvePaint } from './resolve';
import { PAINT_TYPES, type PaintConfig } from './types';

const zones = ['body', 'roof', 'hood'];

describe('renk dönüşümleri', () => {
  it('hex normalize eder', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('c4410f')).toBe('#c4410f');
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('kırmızı')).toBeNull();
  });

  it('hex <-> rgb <-> hsv gidiş-dönüş', () => {
    for (const hex of ['#000000', '#ffffff', '#c4410f', '#1d4fa8', '#7f7f7f', '#00ff80'])
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    expect(rgbToHex(hexToRgb('#123456'))).toBe('#123456');
  });

  it('saf renklerin tonu doğru', () => {
    expect(hexToHsv('#ff0000').h).toBeCloseTo(0);
    expect(hexToHsv('#00ff00').h).toBeCloseTo(1 / 3);
    expect(hexToHsv('#0000ff').h).toBeCloseTo(2 / 3);
  });
});

describe('boya doğrulama', () => {
  it('varsayılan, palet ve presetler geçerli', () => {
    expect(validatePaint(DEFAULT_PAINT)).toEqual([]);
    expect(paintPalette.length).toBeGreaterThanOrEqual(12);
    for (const p of paintPresets) expect(validatePaint(p.paint), p.id).toEqual([]);
  });

  it('presetler 8 boya tipinin hepsini kapsar', () => {
    expect(new Set(paintPresets.map((p) => p.paint.type))).toEqual(new Set(PAINT_TYPES));
  });

  it('sanitize geçersiz alanları düzeltir', () => {
    const p = sanitizePaint({
      type: 'plasma',
      color: 'ABC',
      gloss: 7,
      flakeDensity: -1,
      flakeSize: 'x',
    });
    expect(p.type).toBe(DEFAULT_PAINT.type);
    expect(p.color).toBe('#aabbcc');
    expect(p.gloss).toBe(1);
    expect(p.flakeDensity).toBe(0);
    expect(p.flakeSize).toBe(DEFAULT_PAINT.flakeSize);
  });

  it('validate hataları raporlar', () => {
    expect(validatePaint({ ...DEFAULT_PAINT, type: 'plasma', gloss: 2 })).toHaveLength(2);
    expect(validatePaint('boya')).toHaveLength(1);
  });

  it('normalizePaintMap her bölgeyi doldurur, fazlasını atar', () => {
    const map = normalizePaintMap(
      { roof: { ...DEFAULT_PAINT, type: 'matte' }, wing: DEFAULT_PAINT },
      zones,
    );
    expect(Object.keys(map)).toEqual(zones);
    expect(map.roof?.type).toBe('matte');
    expect(map.body).toEqual(DEFAULT_PAINT);
  });
});

describe('boya JSON', () => {
  const map: Record<string, PaintConfig> = {
    body: paintPresets.find((p) => p.paint.type === 'chameleon')!.paint,
    roof: { ...DEFAULT_PAINT, type: 'matte', color: '#101010' },
    hood: { ...DEFAULT_PAINT, type: 'candy', gloss: 0.42 },
  };

  it('dışa aktarılan JSON aynen geri yüklenir', () => {
    expect(parsePaintExport(serializePaintMap(map), zones)).toEqual(map);
  });

  it('tek bir boya tüm bölgelere uygulanır', () => {
    const out = parsePaintExport(JSON.stringify(map.roof), zones);
    for (const z of zones) expect(out[z]).toEqual(map.roof);
  });

  it('bozuk veya yabancı dosyayı anlaşılır hatayla reddeder', () => {
    const file = (version: number, z: object) =>
      JSON.stringify({ format: 'muscle-garage/paint', version, zones: z });
    expect(() => parsePaintExport('{', zones)).toThrow(PaintImportError);
    expect(() => parsePaintExport('{"foo":1}', zones)).toThrow(PaintImportError);
    expect(() => parsePaintExport(file(99, {}), zones)).toThrow(/sürüm/);
    expect(() => parsePaintExport(file(1, { wing: {} }), zones)).toThrow(/bölge/);
  });
});

describe('boya tipleri', () => {
  const resolved = PAINT_TYPES.map((type) => resolvePaint({ ...DEFAULT_PAINT, type }));
  const by = Object.fromEntries(PAINT_TYPES.map((type, i) => [type, resolved[i]!]));

  it('8 tipin fiziksel parametreleri birbirinden ayırt edilebilir', () => {
    const signature = (r: (typeof resolved)[number]) =>
      [r.metalness, r.roughness, r.clearcoat, r.flakeStrength, r.fresnel, r.iridescence, r.sheen]
        .map((v) => v.toFixed(2))
        .join('|');
    expect(new Set(resolved.map(signature)).size).toBe(PAINT_TYPES.length);
    expect(new Set(resolved.map((r) => r.mode)).size).toBe(PAINT_TYPES.length);
  });

  it('spesifikasyondaki temel özellikler', () => {
    expect(by.solid!.clearcoat).toBe(1);
    expect(by.matte!.clearcoat).toBe(0);
    expect(by.matte!.roughness).toBeGreaterThan(0.6);
    expect(by.chrome!.metalness).toBe(1);
    expect(by.chrome!.roughness).toBeLessThan(0.05);
    expect(by.chameleon!.iridescence).toBeGreaterThan(0);
    expect(by.chameleon!.iridescenceThicknessRange).toEqual([100, 800]);
    expect(by.metallic!.flakeDensity).toBeGreaterThan(0);
    expect(by.solid!.flakeDensity).toBe(0);
  });

  it('parlaklık vernik pürüzlülüğünü düşürür', () => {
    const dull = resolvePaint({ ...DEFAULT_PAINT, type: 'solid', gloss: 0 });
    const shiny = resolvePaint({ ...DEFAULT_PAINT, type: 'solid', gloss: 1 });
    expect(shiny.clearcoatRoughness).toBeLessThan(dull.clearcoatRoughness);
  });

  it('pul boyutu büyüdükçe hücre ölçeği küçülür', () => {
    const fine = resolvePaint({ ...DEFAULT_PAINT, flakeSize: 0 });
    const coarse = resolvePaint({ ...DEFAULT_PAINT, flakeSize: 1 });
    expect(coarse.flakeScale).toBeLessThan(fine.flakeScale);
  });
});
