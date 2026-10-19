import { describe, expect, it } from 'vitest';
import { getCar } from '../../data/cars';
import { sample1, sample2 } from '../surface';
import { bottomY, deckHalfWidth, hoodRearZ, noseZ, restY, tailZ, topY } from './pose';

const mustang = getCar('ford_mustang_gt_2013');
const vanta = getCar('vanta_stallion_70');

describe('yüzey ızgarası örnekleme', () => {
  it('1B: doğrusal ara değer, eksik komşuda var olan', () => {
    const g = { start: 0, step: 1, values: [0, 10, null, 30] };
    expect(sample1(g, 0.5)).toBe(5);
    expect(sample1(g, 1.5)).toBe(10);
    expect(sample1(g, 2.5)).toBe(30);
  });

  it('2B: çift doğrusal; tümü eksikse null', () => {
    const g = {
      z0: 0,
      dz: 1,
      c0: 0,
      dc: 1,
      values: [
        [0, 2],
        [2, 4],
      ] as (number | null)[][],
    };
    expect(sample2(g, 0.5, 0.5)).toBe(2);
    expect(
      sample2(
        {
          ...g,
          values: [
            [null, null],
            [null, null],
          ],
        },
        0.5,
        0.5,
      ),
    ).toBeNull();
  });
});

describe('parça yerleşimi gerçek Mustang yüzeyine göre', () => {
  it('Mustang yüzey haritası yüklü, Vanta profil kullanır', () => {
    expect(mustang.surface).toBeDefined();
    expect(vanta.surface).toBeUndefined();
    expect(topY(vanta, 1.2, 0.5)).toBe(vanta.body.deckY(1.2));
  });

  it('kaput pimi kaputun kendi x’indeki yüzeyde (profil 13 cm yukarıdaydı)', () => {
    const y = topY(mustang, 2.05, 0.55);
    expect(y).toBeGreaterThan(0.76);
    expect(y).toBeLessThan(0.84);
    expect(mustang.body.deckY(2.05) - y).toBeGreaterThan(0.08);
  });

  it('kavisli kaputta oturma yüksekliği ayak izinin en alçak noktası', () => {
    const center = topY(mustang, 1.3);
    const rest = restY(mustang, 1.3, 0.25, 0, 0.21);
    expect(rest).toBeLessThanOrEqual(center);
    expect(center - rest).toBeLessThan(0.05);
  });

  it('bagaj kapağı kenarı ve genişliği (spoyler buraya oturur)', () => {
    const deck = topY(mustang, -mustang.body.halfLength + 0.3);
    const edge = tailZ(mustang, deck - 0.03);
    expect(edge).toBeGreaterThan(-2.27);
    expect(edge).toBeLessThan(-2.15);
    const half = deckHalfWidth(mustang, edge + 0.22);
    expect(half).toBeGreaterThan(0.45);
    expect(half).toBeLessThan(0.9);
  });

  it('kaputun arka kenarı ön camın bittiği yerde (profil 0,66 diyordu, gerçek ≈0,9)', () => {
    const z = hoodRearZ(mustang);
    expect(z).toBeGreaterThan(0.8);
    expect(z).toBeLessThan(1.05);
    expect(hoodRearZ(vanta)).toBe(vanta.body.profile.hood.zStart);
  });

  it('ön tampon alt kenarı (lip bunun altına girer) ve burun', () => {
    const front = noseZ(mustang, 0.3);
    expect(front).toBeGreaterThan(2.25);
    expect(front).toBeLessThan(2.4);
    const lower = bottomY(mustang, front - 0.12);
    expect(lower).toBeGreaterThan(0.15);
    expect(lower).toBeLessThan(0.25);
  });
});
