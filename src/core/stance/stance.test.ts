import { describe, expect, it } from 'vitest';
import { axleBodies, trackLimitMm } from '../../car/fitmentBody';
import { getCar } from '../../data/cars';
import { createDefaultBuild, withLook } from '../build/build';
import { CURRENT_BUILD_VERSION } from '../build/types';
import { normalizePerformance } from '../performance/performance';
import { deserializeBuild } from '../build/serialize';
import { createBuildStore } from '../store/buildStore';
import { checkFitment } from '../wheels/fitment';
import { DEFAULT_FITMENT } from '../wheels/wheels';
import {
  effectiveTrackMm,
  glassOpacity,
  normalizeGlass,
  normalizeLighting,
  normalizeStance,
  presetStance,
  STANCE_PRESETS,
  stanceBodyOffset,
  stanceData,
} from './stance';

const car = getCar('vanta_stallion_70');
const stockParts = Object.fromEntries(
  Object.entries(car.manifest.slots).map(([id, s]) => [id, s.default]),
);
const zero = { front: 0, rear: 0 };

describe('duruş değerleri', () => {
  it('sınırlar spesifikasyondaki aralıkta tutulur (§5.5)', () => {
    const s = normalizeStance({
      rideHeightMm: { front: -500, rear: 500 },
      camberDeg: { front: -20, rear: 9 },
      trackMm: { front: 99, rear: -4 },
    });
    expect(s.rideHeightMm).toEqual({ front: -80, rear: 100 });
    expect(s.camberDeg).toEqual({ front: -8, rear: 2 });
    expect(s.trackMm).toEqual({ front: 40, rear: 0 });
  });

  it('bozuk veri varsayılana düşer', () => {
    expect(normalizeStance(null)).toEqual(stanceData.defaults.stance);
    expect(normalizeStance({ rideHeightMm: { front: 'x' } }).rideHeightMm.front).toBe(0);
    expect(normalizeGlass({ tint: 5, color: 'zzz' })).toEqual({
      tint: 0.95,
      color: stanceData.defaults.glass.color,
    });
    expect(normalizeLighting({ underglow: { enabled: 'evet', intensity: 3 } }).underglow).toEqual({
      ...stanceData.defaults.lighting.underglow,
      intensity: 1,
    });
  });

  it('tüm presetler geçerli ve rake arkayı yüksek, ön alçak tutar', () => {
    for (const id of STANCE_PRESETS)
      expect(normalizeStance(presetStance(id))).toEqual(presetStance(id));
    const rake = presetStance('rake');
    expect(rake.rideHeightMm.rear).toBeGreaterThan(rake.rideHeightMm.front);
    expect(presetStance('yok')).toEqual(stanceData.defaults.stance);
  });
});

describe('gövde yükselmesi ve spacer', () => {
  it('eşit sürüş yüksekliği eğim vermez, rake burnu aşağı eğer', () => {
    const wb = car.manifest.dimensions.wheelbase;
    expect(stanceBodyOffset(presetStance('slammed'), wb).pitch).toBeCloseTo(0, 1);
    expect(stanceBodyOffset(presetStance('stock'), wb)).toEqual({ lift: 0, pitch: -0 });
    // Arka yüksek: burun (+z) aşağı → +x dönüşü (pozitif pitch)
    expect(stanceBodyOffset(presetStance('rake'), wb).pitch).toBeGreaterThan(0);
    expect(stanceBodyOffset(presetStance('gasser'), wb).pitch).toBeLessThan(0);
    expect(stanceBodyOffset(presetStance('slammed'), wb).lift).toBeLessThan(0);
  });

  it('spacer çamurluk tipinin sınırıyla kesilir', () => {
    const s = normalizeStance({ trackMm: { front: 40, rear: 10 } });
    const limit = trackLimitMm(car, stockParts);
    expect(limit).toBe(15);
    expect(effectiveTrackMm(s, 'front', limit)).toBe(15);
    expect(effectiveTrackMm(s, 'rear', limit)).toBe(10);
    expect(trackLimitMm(car, { ...stockParts, fenders: 'widebody' })).toBe(40);
  });

  it('cam koyuluğu arttıkça opaklık artar', () => {
    expect(glassOpacity(0.95)).toBeGreaterThan(glassOpacity(0.2));
    expect(glassOpacity(0)).toBeGreaterThan(0);
    expect(glassOpacity(0.95)).toBeLessThanOrEqual(1);
  });
});

describe('fitment: spacer ve kamber', () => {
  const bodies = axleBodies(car, stockParts);
  const stance = { trackMm: zero, camberDeg: zero };

  it('spacer lastiği çamurluktan dışarı çıkarır', () => {
    const base = checkFitment(DEFAULT_FITMENT, bodies, zero, stance);
    const spaced = checkFitment(DEFAULT_FITMENT, bodies, zero, {
      ...stance,
      trackMm: { front: 40, rear: 40 },
    });
    expect(spaced.filter((i) => i.code === 'fender_poke').length).toBeGreaterThanOrEqual(
      base.filter((i) => i.code === 'fender_poke').length,
    );
    expect(spaced.some((i) => i.code === 'fender_poke')).toBe(true);
  });

  it('negatif kamber iç davlumbaza yaklaşırken dış taşmayı artırmaz', () => {
    const flat = checkFitment(DEFAULT_FITMENT, bodies, zero, stance);
    const camber = checkFitment(DEFAULT_FITMENT, bodies, zero, {
      ...stance,
      camberDeg: { front: -8, rear: -8 },
    });
    const amount = (list: typeof flat, code: string) =>
      list.find((i) => i.code === code)?.amountMm ?? 0;
    expect(amount(camber, 'fender_poke')).toBe(amount(flat, 'fender_poke'));
    expect(amount(camber, 'inner_rub')).toBeGreaterThanOrEqual(amount(flat, 'inner_rub'));
  });

  it('varsayılan duruş stok kurulumda uyarı vermez', () => {
    expect(checkFitment(DEFAULT_FITMENT, bodies, zero, stance)).toEqual([]);
  });
});

describe('duruş / cam / ışık kaydı', () => {
  it("v4 kaydı v5'e taşınır ve alanlar varsayılanla dolar", () => {
    const v4 = { ...createDefaultBuild(car.manifest), version: 4 } as Record<string, unknown>;
    delete v4.stance;
    delete v4.glass;
    delete v4.lighting;
    const migrated = deserializeBuild(JSON.stringify(v4), car.manifest);
    expect(migrated.version).toBe(CURRENT_BUILD_VERSION);
    expect(migrated.performance).toEqual(normalizePerformance({}));
    expect(migrated.stance).toEqual(stanceData.defaults.stance);
    expect(migrated.glass).toEqual(stanceData.defaults.glass);
  });

  it('withLook değerleri normalize eder', () => {
    const b = withLook(createDefaultBuild(car.manifest), {
      glass: { tint: 9, color: '#123456' },
    });
    expect(b.glass.tint).toBe(0.95);
  });

  it('sürükleme tek undo adımı yazar, önizleme geçmişe girmez', () => {
    const store = createBuildStore(car.manifest);
    const s = () => store.getState();
    s().previewLook({ stance: presetStance('slammed') });
    expect(s().history.past.length).toBe(0);
    s().previewLook({ stance: presetStance('rake') });
    s().commitLookPreview();
    expect(s().build.stance).toEqual(presetStance('rake'));
    expect(s().history.past.length).toBe(1);
    s().undo();
    expect(s().build.stance).toEqual(stanceData.defaults.stance);
    expect(s().lookPreview).toBeNull();
  });
});
