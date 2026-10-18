import { describe, expect, it } from 'vitest';
import { getCar } from '../../data/cars';
import { createDefaultBuild, withPerformance } from '../build/build';
import { deserializeBuild, serializeBuild } from '../build/serialize';
import {
  buildStats,
  buildWeightKg,
  camberGripFactors,
  dynoCurve,
  engineSpec,
  hasSupercharger,
  normalizePerformance,
  perfData,
  statFraction,
  tireGrip,
} from './performance';

const car = getCar('vanta_stallion_70');
const base = createDefaultBuild(car.manifest);
const stats = (b = base) => buildStats(b, car.parts, car.manifest.massKg);

describe('performans parçaları', () => {
  it('bozuk veri varsayılana düşer, geçerli değerler korunur', () => {
    expect(normalizePerformance(null)).toEqual(perfData.defaults);
    expect(normalizePerformance({ engine: 'nitro', brakes: 5 })).toEqual(perfData.defaults);
    expect(normalizePerformance({ engine: 'race', suspension: 'stiff' })).toMatchObject({
      engine: 'race',
      suspension: 'stiff',
    });
  });

  it('kayıt gidiş-dönüşünde performans korunur', () => {
    const b = withPerformance(base, { engine: 'street', transmission: 'race6' });
    const back = deserializeBuild(serializeBuild(b), car.manifest);
    expect(back.performance).toEqual(b.performance);
  });

  it('daha güçlü motor seviyesi hem tork hem beygir artırır', () => {
    const s = stats();
    const street = stats(withPerformance(base, { engine: 'street' }));
    const race = stats(withPerformance(base, { engine: 'race' }));
    expect(street.hp).toBeGreaterThan(s.hp);
    expect(race.hp).toBeGreaterThan(street.hp);
    expect(race.torqueNm).toBeGreaterThan(street.torqueNm);
  });

  it('süperşarjör (blower_v8) görünümü tork ve beygiri artırır', () => {
    const blown = { ...base, parts: { ...base.parts, engine: 'blower_v8' } };
    expect(hasSupercharger(blown.parts)).toBe(true);
    expect(stats(blown).torqueNm).toBeGreaterThan(stats().torqueNm * 1.15);
    expect(stats(blown).hp).toBeGreaterThan(stats().hp);
  });

  it('fren parçası fren istatistiğini, lastik tipi tutuşu etkiler', () => {
    expect(stats(withPerformance(base, { brakes: 'race' })).braking).toBeGreaterThan(
      stats().braking,
    );
    const slick = stats({
      ...base,
      tires: {
        front: { ...base.tires.front, type: 'semi_slick' },
        rear: { ...base.tires.rear, type: 'semi_slick' },
      },
    });
    expect(slick.grip).toBeGreaterThan(stats().grip);
  });

  it('ağırlık parça kataloğu ve performans parçalarının toplamıdır', () => {
    const w0 = buildWeightKg(base, car.parts, car.manifest.massKg);
    expect(w0).toBeGreaterThanOrEqual(car.manifest.massKg - 100);
    const race = withPerformance(base, { engine: 'race' });
    expect(buildWeightKg(race, car.parts, car.manifest.massKg)).toBe(
      w0 + perfData.engine.race.weightKg,
    );
  });

  it('dyno eğrisi redline altında pozitif, redline sonrası sıfır tork', () => {
    const spec = engineSpec(base.performance, false);
    const pts = dynoCurve(spec);
    expect(pts[0]?.rpm).toBe(spec.idleRpm);
    expect(pts[pts.length - 1]?.rpm).toBe(spec.redlineRpm);
    expect(pts.every((p) => p.torque > 0 && p.hp > 0)).toBe(true);
    expect(spec.torqueAt(spec.redlineRpm + 1)).toBe(0);
    // Tork tepe değeri orta devirde, beygir tepe değeri tork tepesinden yüksek devirde
    const peakTq = pts.reduce((a, b) => (b.torque > a.torque ? b : a));
    const peakHp = pts.reduce((a, b) => (b.hp > a.hp ? b : a));
    expect(peakHp.rpm).toBeGreaterThan(peakTq.rpm);
  });

  it('lastik genişliği tutuşu artırır, kamber çarpanları makul', () => {
    const t = base.tires.rear;
    expect(tireGrip({ ...t, widthMm: 305 }).lateral).toBeGreaterThan(
      tireGrip({ ...t, widthMm: 205 }).lateral,
    );
    expect(camberGripFactors(-2).lateral).toBeGreaterThan(camberGripFactors(0).lateral);
    expect(camberGripFactors(-8).longitudinal).toBeLessThan(1);
    expect(camberGripFactors(0).longitudinal).toBe(1);
  });

  it('çubuk oranı 0..1 aralığında kalır', () => {
    expect(statFraction('hp', 0)).toBe(0);
    expect(statFraction('hp', 99999)).toBe(1);
    const mid = statFraction('weightKg', 1550);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('tüm seçeneklerin çevirisi var', async () => {
    const { t } = await import('../../i18n');
    const groups: [string, string[]][] = [
      ['perfEngine', Object.keys(perfData.engine)],
      ['perfTransmission', Object.keys(perfData.transmission)],
      ['perfBrakes', Object.keys(perfData.brakes)],
      ['perfSuspension', Object.keys(perfData.suspension)],
    ];
    for (const [prefix, ids] of groups)
      for (const id of ids) expect(t(`${prefix}.${id}`)).not.toBe(`${prefix}.${id}`);
    for (const key of ['hp', 'torqueNm', 'weightKg', 'grip', 'braking'])
      expect(t(`stat.${key}`)).not.toBe(`stat.${key}`);
  });
});
