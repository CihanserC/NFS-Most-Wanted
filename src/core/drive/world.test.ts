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

  it('segmentler pist kenarına yakın (bariyer mesafesi civarında)', () => {
    for (const b of barriers) {
      const d = distanceToTrack(track, b.x, b.z);
      expect(d).toBeGreaterThan(edge - 4);
      expect(d).toBeLessThan(edge + 1.5);
      expect(b.halfLength).toBeGreaterThan(2);
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
    expect(scenery.trees.length).toBeGreaterThan(80);
    expect(scenery.rocks.length).toBeGreaterThan(40);
    for (const item of [...scenery.trees, ...scenery.rocks])
      expect(distanceToTrack(track, item.x, item.z)).toBeGreaterThanOrEqual(min);
  });

  it('lamba direkleri düzlüklerde, tribünler başlangıç çizgisi yanında', () => {
    expect(scenery.lamps.length).toBeGreaterThan(5);
    expect(scenery.grandstands).toHaveLength(2);
    const start = track.samples[track.startIndex]!;
    for (const g of scenery.grandstands)
      expect(Math.hypot(g.x - start.x, g.z - start.z)).toBeLessThan(80);
  });
});
