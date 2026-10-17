import { describe, expect, it } from 'vitest';
import { Box3, type BufferGeometry } from 'three';
import { lruMemoize } from '../../../core/cache/lru';
import { brakeMetrics, rimMetrics, WHEEL_DIM } from '../../../core/wheels/dimensions';
import { WHEEL_STYLES, type WheelConfig } from '../../../core/wheels/types';
import {
  DEFAULT_FITMENT,
  maxDiscMm,
  sanitizeWheel,
  tireOuterRadiusM,
  wheelLimits,
  wheelStyles,
} from '../../../core/wheels/wheels';
import { getBrakeGeometry } from './brakeGeometry';
import { buildRim, getRimGeometry } from './rimGeometry';
import { buildTire, getTireGeometry, tireProfile } from './tireGeometry';

const base = DEFAULT_FITMENT.wheels.front;
const wheel = (patch: Partial<WheelConfig>) => sanitizeWheel({ ...base, ...patch }, base);

const finite = (g: BufferGeometry) =>
  Array.from(g.getAttribute('position').array).every(Number.isFinite);
const bbox = (g: BufferGeometry) =>
  new Box3().setFromBufferAttribute(g.getAttribute('position') as never);

const DIAMETERS = Array.from(
  { length: wheelLimits.diameterIn.max - wheelLimits.diameterIn.min + 1 },
  (_, i) => wheelLimits.diameterIn.min + i,
);
const WIDTHS = [wheelLimits.widthIn.min, wheelLimits.widthIn.max];

describe('prosedürel jant', () => {
  it('tüm stiller tüm çap/genişlik ve kol aralıklarında geçerli geometri üretir', () => {
    let count = 0;
    for (const style of WHEEL_STYLES) {
      const s = wheelStyles[style];
      const spokeOptions = s.spokes ? [s.spokes.min, s.spokes.max] : [s.fixedSpokes ?? 5];
      for (const diameterIn of DIAMETERS)
        for (const widthIn of WIDTHS)
          for (const spokes of spokeOptions)
            for (const lipIn of [s.lipIn.min, s.lipIn.max]) {
              const w = wheel({ style, diameterIn, widthIn, spokes, lipIn });
              const rim = buildRim(w);
              const m = rimMetrics(w);
              const label = `${style} ${diameterIn}x${widthIn} kol=${spokes} lip=${lipIn}`;
              for (const g of [rim.barrel, rim.lip, rim.face, rim.lugs, rim.cap]) {
                expect(finite(g), label).toBe(true);
                expect(g.getAttribute('position').count, label).toBeGreaterThan(0);
              }
              // Jant dış çapı flanş dahil, yüz jantın içinde kalır.
              const outer = bbox(rim.lip);
              expect(outer.max.x, label).toBeCloseTo(m.rimRadius + WHEEL_DIM.flangeHeight, 3);
              const face = bbox(rim.face);
              expect(Math.max(face.max.x, face.max.y), label).toBeLessThanOrEqual(m.rimRadius);
              // Jant genişliği ölçüye uyar.
              const barrel = bbox(rim.barrel);
              expect(outer.max.z - barrel.min.z, label).toBeCloseTo(2 * m.halfWidth + 0.002, 2);
              count++;
            }
    }
    expect(count).toBeGreaterThan(300);
  });

  it('3 parçalı jantta cıvatalar var, diğerlerinde yok', () => {
    expect(buildRim(wheel({ style: 'deep_dish_3pc' })).rivets).not.toBeNull();
    expect(buildRim(wheel({ style: 'mesh' })).rivets).toBeNull();
  });

  it('dudak derinliği yüzü içeri çeker', () => {
    const w = { style: 'deep_dish_3pc' as const, widthIn: 12, offsetMm: -30 };
    const shallow = bbox(buildRim(wheel({ ...w, lipIn: 2 })).face);
    const deep = bbox(buildRim(wheel({ ...w, lipIn: 5 })).face);
    expect(deep.max.z).toBeLessThan(shallow.max.z);
  });
});

describe('kaliper kolların arasından görünür', () => {
  // Kaliperin yarıçap aralığı, kol pencerelerinin yarıçap aralığıyla örtüşmeli.
  for (const style of WHEEL_STYLES.filter((s) => s !== 'steel_dogdish'))
    it(style, () => {
      for (const diameterIn of DIAMETERS) {
        const w = wheel({ style, diameterIn });
        const m = rimMetrics(w);
        const b = brakeMetrics(DEFAULT_FITMENT.brakes, maxDiscMm(diameterIn));
        expect(b.caliperOuterRadius, `${diameterIn}"`).toBeGreaterThan(WHEEL_DIM.windowInnerRadius);
        expect(b.caliperInnerRadius, `${diameterIn}"`).toBeLessThan(m.windowOuterRadius);
        // Kaliper jantın iç yüzeyine sığar.
        expect(b.caliperOuterRadius, `${diameterIn}"`).toBeLessThan(m.rimRadius);
      }
    });
});

describe('lastik', () => {
  it('profil jantı ve dış çapı doğru sarar', () => {
    const w = wheel({ diameterIn: 17, widthIn: 8 });
    const t = { ...DEFAULT_FITMENT.tires.front, widthMm: 245, aspect: 45 };
    const p = tireProfile(w, t);
    const radii = [...p.inner, ...p.tread, ...p.outer].map(([r]) => r);
    expect(Math.max(...radii)).toBeCloseTo(tireOuterRadiusM(17, t), 5);
    expect(Math.min(...radii)).toBeGreaterThan(rimMetrics(w).rimRadius);
  });

  it('dolgun lastik yanaktan şişer, esnetilmiş lastik şişmez', () => {
    const w = wheel({ widthIn: 8 });
    const widest = (widthMm: number) =>
      Math.max(
        ...tireProfile(w, { ...DEFAULT_FITMENT.tires.front, widthMm }).outer.map(([, z]) => z),
      );
    const meaty = widest(275);
    const stretched = widest(185);
    expect(meaty).toBeGreaterThan(0.275 / 2);
    expect(stretched).toBeLessThanOrEqual((8 * 0.0254) / 2);
  });

  it('tüm ölçü uçlarında geçerli geometri', () => {
    for (const diameterIn of [14, 22])
      for (const widthMm of [wheelLimits.tireWidthMm.min, wheelLimits.tireWidthMm.max])
        for (const aspect of [wheelLimits.tireAspect.min, wheelLimits.tireAspect.max]) {
          const g = buildTire(wheel({ diameterIn }), {
            ...DEFAULT_FITMENT.tires.front,
            widthMm,
            aspect,
          });
          for (const part of [g.innerSidewall, g.tread, g.outerSidewall])
            expect(finite(part)).toBe(true);
        }
  });
});

describe('geometri önbelleği', () => {
  it('aynı parametrelerle jant/lastik/fren yeniden üretilmez', () => {
    const w = wheel({ style: 'mesh', diameterIn: 19 });
    const t = DEFAULT_FITMENT.tires.front;
    const b = DEFAULT_FITMENT.brakes;
    const rimBuilds = getRimGeometry.builds();
    expect(getRimGeometry(w)).toBe(getRimGeometry({ ...w }));
    // Kaplama/renk geometriyi etkilemez.
    expect(getRimGeometry({ ...w, finish: 'chrome', color: '#ff0000' })).toBe(getRimGeometry(w));
    expect(getRimGeometry.builds()).toBe(rimBuilds + 1);
    expect(getTireGeometry(w, t)).toBe(getTireGeometry(w, { ...t, sidewall: 'whitewall' }));
    expect(getBrakeGeometry(b, 300)).toBe(getBrakeGeometry({ ...b, caliperColor: '#00ff00' }, 300));
    expect(getBrakeGeometry(b, 300)).not.toBe(getBrakeGeometry(b, 320));
  });

  it('LRU sınırı aşılınca en eski girdi atılır ve dispose edilir', () => {
    const evicted: number[] = [];
    const cache = lruMemoize(
      (n: number) => String(n),
      (n: number) => n,
      {
        max: 3,
        onEvict: (v) => evicted.push(v),
      },
    );
    cache(1);
    cache(2);
    cache(3);
    cache(1); // 1 en son kullanılan olur
    cache(4); // 2 atılır
    expect(evicted).toEqual([2]);
    expect([...cache.cache.keys()]).toEqual(['3', '1', '4']);
  });
});
