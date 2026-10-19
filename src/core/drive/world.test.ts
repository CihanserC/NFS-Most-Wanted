import { describe, expect, it } from 'vitest';
import { computeBarriers } from './barriers';
import { buildScenery, distanceToTrack } from './scenery';
import { getDefaultTrack } from './track';

const track = getDefaultTrack();
const edge = track.widthM / 2 + track.config.barrierOffsetM;

describe('bariyerler', () => {
  const barriers = computeBarriers(track);

  it('pistin iki yanına yeterli sayıda segment konur', () => {
    expect(barriers.length).toBeGreaterThan(80);
    expect(barriers.length).toBeLessThanOrEqual(2 * Math.ceil(track.samples.length / 6));
  });

  it('hiçbir bariyer asfalta ya da kerbe girmez', () => {
    const clearance = track.widthM / 2 + track.config.kerbM + 1;
    for (const b of barriers) expect(distanceToTrack(track, b.x, b.z)).toBeGreaterThan(clearance);
  });

  it('segmentler pist kenarına yakın (viraj içinde daraltılmış olabilir)', () => {
    const min = track.widthM / 2 + track.config.kerbM + 1;
    for (const b of barriers) {
      const d = distanceToTrack(track, b.x, b.z);
      expect(d).toBeGreaterThan(min);
      expect(d).toBeLessThan(edge + 1.5);
      expect(b.halfLength).toBeGreaterThan(1);
    }
  });

  it('her kenarda zincir kesintisiz: ardışık segmentlerin uçları örtüşür (araç kaçamaz)', () => {
    const ends = (b: (typeof barriers)[number]) => {
      const ux = Math.sin(b.yaw) * b.halfLength;
      const uz = Math.cos(b.yaw) * b.halfLength;
      return { start: [b.x - ux, b.z - uz], end: [b.x + ux, b.z + uz] };
    };
    for (const side of [1, -1] as const) {
      const chain = barriers.filter((b) => b.side === side);
      chain.forEach((b, i) => {
        const next = chain[(i + 1) % chain.length]!;
        const a = ends(b).end;
        const c = ends(next).start;
        // Uçlar arası mesafe örtüşme payının altında: aralık yok
        expect(Math.hypot(a[0]! - c[0]!, a[1]! - c[1]!)).toBeLessThan(1.3);
      });
    }
  });
});

describe('çevre yerleşimi', () => {
  const scenery = buildScenery(track);

  it('aynı tohum aynı yerleşimi verir (tekrarlanabilir)', () => {
    expect(buildScenery(track)).toEqual(scenery);
    expect(buildScenery(track, 99)).not.toEqual(scenery);
  });

  it('ağaç ve kayalar pistten ve bariyerden uzak', () => {
    const min = edge;
    expect(scenery.pines.length).toBeGreaterThan(150);
    expect(scenery.oaks.length).toBeGreaterThan(100);
    expect(scenery.rocks.length).toBeGreaterThan(40);
    for (const item of [...scenery.pines, ...scenery.oaks, ...scenery.rocks])
      expect(distanceToTrack(track, item.x, item.z)).toBeGreaterThanOrEqual(min);
  });

  it('lamba direkleri düzlüklerde, tribünler başlangıç çizgisi yanında', () => {
    expect(scenery.lamps.length).toBeGreaterThan(5);
    expect(scenery.grandstands).toHaveLength(2);
    const start = track.samples[track.startIndex]!;
    for (const g of scenery.grandstands)
      expect(Math.hypot(g.x - start.x, g.z - start.z)).toBeLessThan(80);
    expect(Math.hypot(scenery.gantry.x - start.x, scenery.gantry.z - start.z)).toBeLessThan(1);
    // Direkler bariyerin dışında
    expect(scenery.gantry.span / 2).toBeGreaterThan(edge);
  });
});
