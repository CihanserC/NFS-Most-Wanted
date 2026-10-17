import { describe, expect, it } from 'vitest';
import { axleBodies } from '../../car/fitmentBody';
import { getCar } from '../../data/cars';
import { createBuildStore } from '../store/buildStore';
import { brakeMetrics, dishZ, rimMetrics } from './dimensions';
import { checkFitment, bodyLift } from './fitment';
import type { FitmentState } from './types';
import { WHEEL_STYLES } from './types';
import {
  DEFAULT_FITMENT,
  effectiveDiscMm,
  maxDiscMm,
  normalizeFitment,
  quantize,
  sanitizeTire,
  sanitizeWheel,
  tireLook,
  tireOuterDiameterMm,
  wheelStyles,
} from './wheels';

const car = getCar('vanta_stallion_70');
const stockParts = Object.fromEntries(
  Object.entries(car.manifest.slots).map(([id, s]) => [id, s.default]),
);
const bodies = (parts = stockParts) => axleBodies(car, parts);

const withAxles = (patch: (f: FitmentState) => void): FitmentState => {
  const f = structuredClone(DEFAULT_FITMENT);
  patch(f);
  return normalizeFitment(f);
};

describe('jant/lastik değer doğrulama', () => {
  it('quantize aralığa sıkıştırır ve adıma yuvarlar', () => {
    expect(quantize(7.3, { min: 6, max: 12, step: 0.5 })).toBe(7.5);
    expect(quantize(30, { min: 14, max: 22, step: 1 })).toBe(22);
    expect(quantize(-99, { min: -30, max: 45, step: 1 })).toBe(-30);
  });

  it('jant ölçüleri spesifikasyon aralıklarında tutulur', () => {
    const w = sanitizeWheel(
      { diameterIn: 18.4, widthIn: 13, offsetMm: 60, style: 'mesh', spokes: 99, lipIn: 9 },
      DEFAULT_FITMENT.wheels.front,
    );
    expect(w.diameterIn).toBe(18);
    expect(w.widthIn).toBe(12);
    expect(w.offsetMm).toBe(45);
    expect(w.spokes).toBe(wheelStyles.mesh.spokes!.max);
    expect(w.lipIn).toBe(wheelStyles.mesh.lipIn.max);
  });

  it('klasik 5 kol stilinde kol sayısı sabit', () => {
    const w = sanitizeWheel({ style: 'classic_5spoke', spokes: 12 }, DEFAULT_FITMENT.wheels.front);
    expect(w.spokes).toBe(5);
  });

  it('drag radial ön aksta sokak lastiğine döner', () => {
    expect(sanitizeTire({ type: 'drag_radial' }, DEFAULT_FITMENT.tires.front, 'front').type).toBe(
      'street',
    );
    expect(sanitizeTire({ type: 'drag_radial' }, DEFAULT_FITMENT.tires.rear, 'rear').type).toBe(
      'drag_radial',
    );
  });

  it('bozuk girdi varsayılanlara düşer', () => {
    expect(normalizeFitment(null)).toEqual(normalizeFitment(DEFAULT_FITMENT));
  });
});

describe('ölçü hesapları', () => {
  it('lastik dış çapı = jant + 2 × yanak', () => {
    const tire = { widthMm: 225, aspect: 60, sidewall: 'black', type: 'street' } as const;
    expect(tireOuterDiameterMm(15, tire)).toBeCloseTo(381 + 270);
  });

  it('stok fitment manifestteki tekerlek yüksekliğine yakın', () => {
    const { perAxle } = bodyLift(DEFAULT_FITMENT, { front: 0.33, rear: 0.33 }, 2.74);
    expect(Math.abs(perAxle.front)).toBeLessThan(0.01);
    expect(Math.abs(perAxle.rear)).toBeLessThan(0.02);
  });

  it('büyük arka lastik burnu aşağı eğer (rake)', () => {
    const f = withAxles((x) => {
      x.wheels.rear.diameterIn = 20;
    });
    const { pitch, perAxle } = bodyLift(f, { front: 0.33, rear: 0.33 }, 2.74);
    expect(perAxle.rear).toBeGreaterThan(perAxle.front);
    expect(pitch).toBeGreaterThan(0);
  });

  it('görünüm: genişlik oranına göre stretch / normal / dolgun', () => {
    const w = { ...DEFAULT_FITMENT.wheels.front, widthIn: 9 };
    const t = (widthMm: number) => ({ ...DEFAULT_FITMENT.tires.front, widthMm });
    expect(tireLook(w, t(205)).look).toBe('stretched');
    expect(tireLook(w, t(235)).look).toBe('normal');
    expect(tireLook(w, t(285)).look).toBe('meaty');
  });

  it('disk çapı küçük janta sığacak şekilde sınırlanır', () => {
    expect(maxDiscMm(14)).toBeLessThan(maxDiscMm(18));
    const f = withAxles((x) => {
      x.brakes.discMm = 400;
      x.wheels.front.diameterIn = 14;
      x.wheels.rear.diameterIn = 20;
    });
    expect(f.brakes.discMm).toBe(maxDiscMm(14));
    expect(effectiveDiscMm(f)).toBe(maxDiscMm(14));
  });
});

describe('fitment uyarıları', () => {
  it('stok kurulumda uyarı yok', () => {
    expect(checkFitment(DEFAULT_FITMENT, bodies())).toEqual([]);
  });

  it('çok büyük lastik kemere sürter', () => {
    const f = withAxles((x) => {
      x.wheels.front.diameterIn = 22;
      x.tires.front = { ...x.tires.front, widthMm: 285, aspect: 50 };
    });
    expect(checkFitment(f, bodies()).some((i) => i.axle === 'front' && i.code === 'arch_rub')).toBe(
      true,
    );
  });

  it('negatif offset + geniş jant çamurluktan taşar; widebody bunu azaltır', () => {
    const f = withAxles((x) => {
      x.wheels.rear = { ...x.wheels.rear, widthIn: 10, offsetMm: -25 };
      x.tires.rear = { ...x.tires.rear, widthMm: 275 };
    });
    const poke = (parts: Record<string, string>) =>
      checkFitment(f, bodies(parts)).find((i) => i.axle === 'rear' && i.code === 'fender_poke')
        ?.amountMm ?? 0;
    const stock = poke(stockParts);
    const wide = poke({ ...stockParts, fenders: 'widebody' });
    expect(stock).toBeGreaterThan(0);
    expect(wide).toBeLessThan(stock);
  });

  it('yüksek offset + geniş lastik iç davlumbaza sürter', () => {
    const f = withAxles((x) => {
      x.wheels.front = { ...x.wheels.front, widthIn: 12, offsetMm: 45 };
      x.tires.front = { ...x.tires.front, widthMm: 345 };
    });
    expect(checkFitment(f, bodies()).some((i) => i.code === 'inner_rub')).toBe(true);
  });

  it('alçaltma kemer boşluğunu azaltır', () => {
    const f = withAxles((x) => {
      x.wheels.front.diameterIn = 18;
      x.tires.front = { ...x.tires.front, widthMm: 235, aspect: 45 };
    });
    expect(checkFitment(f, bodies()).some((i) => i.code === 'arch_rub')).toBe(false);
    expect(
      checkFitment(f, bodies(), { front: -80, rear: 0 }).some((i) => i.code === 'arch_rub'),
    ).toBe(true);
  });

  it('dudak derinliği genişlik ve offset ile sınırlanır', () => {
    const narrow = rimMetrics({
      ...DEFAULT_FITMENT.wheels.front,
      widthIn: 7,
      offsetMm: 10,
      lipIn: 5,
    });
    const wide = rimMetrics({
      ...DEFAULT_FITMENT.wheels.front,
      widthIn: 12,
      offsetMm: -30,
      lipIn: 5,
    });
    expect(narrow.effectiveLipIn).toBeLessThan(5);
    expect(narrow.faceEdgeZ).toBe(0);
    expect(wide.effectiveLipIn).toBeCloseTo(5);
  });

  it('kollar hiçbir ayarda kalipere doğru içe bükülmez', () => {
    for (const style of WHEEL_STYLES)
      for (const offsetMm of [-30, 45])
        for (const lipIn of [0, 5]) {
          const w = sanitizeWheel(
            { ...DEFAULT_FITMENT.wheels.front, style, offsetMm, lipIn, widthIn: 6 },
            DEFAULT_FITMENT.wheels.front,
          );
          const b = brakeMetrics(DEFAULT_FITMENT.brakes, maxDiscMm(w.diameterIn));
          expect(dishZ(w, b.caliperOuterRadius)).toBeGreaterThan(b.caliperFrontZ);
        }
  });
});

describe('buildStore jant/lastik/fren', () => {
  it('değişiklik normalize edilir, geri alınır', () => {
    const store = createBuildStore(car.manifest);
    store.getState().setFitment({
      wheels: {
        ...store.getState().build.wheels,
        front: { ...DEFAULT_FITMENT.wheels.front, diameterIn: 30 },
      },
    });
    expect(store.getState().build.wheels.front.diameterIn).toBe(22);
    store.getState().undo();
    expect(store.getState().build.wheels.front.diameterIn).toBe(15);
  });

  it('önizleme geçmişe yazılmaz, commit tek adım', () => {
    const store = createBuildStore(car.manifest);
    for (let d = 15; d <= 20; d++)
      store.getState().previewFitment({
        wheels: {
          ...store.getState().build.wheels,
          rear: { ...DEFAULT_FITMENT.wheels.rear, diameterIn: d },
        },
      });
    expect(store.getState().history.past).toHaveLength(0);
    store.getState().commitFitmentPreview();
    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().build.wheels.rear.diameterIn).toBe(20);
  });
});
