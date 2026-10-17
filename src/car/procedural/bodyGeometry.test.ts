import { describe, expect, it } from 'vitest';
import { getCar } from '../../data/cars';
import {
  buildCabinGeometry,
  buildLowerBodyGeometry,
  CABIN_GROUP,
  getLowerBodyGeometry,
  LOWER_BODY_GROUP,
} from './bodyGeometry';

const car = getCar('vanta_stallion_70');
const dims = car.manifest.dimensions;
const EPS = 0.01;

describe('placeholder gövde geometrisi', () => {
  const lower = buildLowerBodyGeometry(car.body, { hoodCutout: false });
  const cabin = buildCabinGeometry(car.body);

  it('NaN içermez', () => {
    for (const g of [lower, cabin])
      expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true);
  });

  it('alt gövde manifest boyutlarına uyar', () => {
    const box = lower.boundingBox!;
    expect(box.max.z - box.min.z).toBeCloseTo(dims.length, 2);
    expect(box.max.x - box.min.x).toBeLessThanOrEqual(dims.width + EPS);
    expect(box.max.x - box.min.x).toBeGreaterThan(dims.width * 0.9);
    expect(box.min.y).toBeGreaterThan(0);
  });

  it('kabin tavanı manifest yüksekliğine ulaşır', () => {
    expect(cabin.boundingBox!.max.y).toBeCloseTo(dims.height, 2);
  });

  it('tekerlek kemerleri tekerlek + boşluk kadar yüksek', () => {
    for (const a of car.body.wheelArches) {
      const top = car.body.archTopY(a.z);
      expect(top).toBeCloseTo(a.centerY + a.radius, 3);
    }
    const front = car.body.wheelArches[0]!;
    expect(front.radius).toBeCloseTo(0.33 + 0.06, 5);
  });

  it('tüm materyal grupları dolu', () => {
    const groups = (g: typeof lower) =>
      new Set(g.groups.filter((x) => x.count > 0).map((x) => x.materialIndex));
    expect(groups(lower)).toEqual(new Set(Object.values(LOWER_BODY_GROUP)));
    expect(groups(cabin)).toEqual(new Set(Object.values(CABIN_GROUP)));
  });

  it('blower kesiği kaputta delik açar', () => {
    const cut = buildLowerBodyGeometry(car.body, { hoodCutout: true });
    const hoodCount = (g: typeof lower) => g.groups[LOWER_BODY_GROUP.hood]!.count;
    expect(hoodCount(cut)).toBeLessThan(hoodCount(lower));
  });

  it('aynı parametrelerle geometri önbellekten gelir', () => {
    const a = getLowerBodyGeometry(car.manifest.id, car.body, { hoodCutout: false });
    const b = getLowerBodyGeometry(car.manifest.id, car.body, { hoodCutout: false });
    const c = getLowerBodyGeometry(car.manifest.id, car.body, { hoodCutout: true });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
