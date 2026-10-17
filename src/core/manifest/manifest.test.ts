import { describe, expect, it } from 'vitest';
import manifestJson from '../../data/cars/vanta_stallion_70/manifest.json';
import partsJson from '../../data/parts/vanta_stallion_70.json';
import { loadManifest, ManifestError } from './load';
import { validatePartsCatalog } from './parts';
import { validateManifest } from './validate';

const clone = (): Record<string, any> => structuredClone(manifestJson); // eslint-disable-line @typescript-eslint/no-explicit-any -- testte kasıtlı bozma

const errorsOf = (input: unknown): string[] => {
  const r = validateManifest(input);
  return r.ok ? [] : r.errors;
};

describe('manifest doğrulayıcı', () => {
  it('Vanta Stallion manifesti geçerli', () => {
    expect(errorsOf(manifestJson)).toEqual([]);
    expect(loadManifest(manifestJson).displayName).toBe("Vanta Stallion '70");
  });

  it('nesne olmayan girdiyi reddeder', () => {
    expect(errorsOf(null)).toHaveLength(1);
    expect(errorsOf([])).toHaveLength(1);
  });

  it('varsayılanı seçenekler içinde olmayan slotu yakalar', () => {
    const m = clone();
    m.slots.hood.default = 'carbon';
    expect(errorsOf(m)).toEqual([expect.stringContaining('slots.hood.default')]);
  });

  it('tanımsız kamera preset referansını yakalar', () => {
    const m = clone();
    m.slots.grille.camera = 'nowhere';
    expect(errorsOf(m)).toEqual([expect.stringContaining('slots.grille.camera')]);
  });

  it('tekrar eden seçenekleri yakalar', () => {
    const m = clone();
    m.slots.roof.options = ['painted', 'painted'];
    expect(errorsOf(m).some((e) => e.startsWith('slots.roof.options'))).toBe(true);
  });

  it('aks mesafesi ile tekerlek konumları uyuşmazlığını yakalar', () => {
    const m = clone();
    m.dimensions.wheelbase = 2.9;
    expect(errorsOf(m)).toEqual([expect.stringContaining('dimensions.wheelbase')]);
  });

  it('araç dışındaki tekerleği yakalar', () => {
    const m = clone();
    m.wheels.FL.position = [3, 0.33, 1.42];
    m.wheels.FR.position = [-3, 0.33, 1.42];
    const errors = errorsOf(m);
    expect(errors.some((e) => e.startsWith('wheels.FL.position'))).toBe(true);
  });

  it('birden fazla hatayı birlikte raporlar', () => {
    const m = clone();
    m.id = 'Bad Id';
    m.units = 'feet';
    delete m.wheels.RR;
    const errors = errorsOf(m);
    expect(errors.length).toBeGreaterThanOrEqual(3);
    expect(errors.join('\n')).toMatch(/id:.*\n?/);
  });

  it('loadManifest hatalı manifestte anlaşılır ManifestError fırlatır', () => {
    const m = clone();
    m.slots.hood.default = 'carbon';
    expect(() => loadManifest(m, 'test.json')).toThrow(ManifestError);
    expect(() => loadManifest(m, 'test.json')).toThrow(/test\.json[\s\S]*slots\.hood\.default/);
  });
});

describe('parça kataloğu', () => {
  const manifest = loadManifest(manifestJson);

  it('her slot seçeneği katalogda tanımlı', () => {
    expect(validatePartsCatalog(partsJson, manifest)).toEqual([]);
  });

  it('eksik ve fazla seçenekleri yakalar', () => {
    const parts = structuredClone(partsJson) as Record<string, Record<string, unknown>>;
    delete parts.hood?.shaker_scoop;
    (parts.grille as Record<string, unknown>).gold = { price: 1, weightKg: 0 };
    const errors = validatePartsCatalog(parts, manifest);
    expect(errors).toContain('parts.hood.shaker_scoop: eksik');
    expect(errors).toContain('parts.grille.gold: manifestte yok');
  });

  it('her parçanın fiyat alanı var', () => {
    for (const options of Object.values(partsJson))
      for (const p of Object.values(options)) expect(typeof p.price).toBe('number');
  });
});
