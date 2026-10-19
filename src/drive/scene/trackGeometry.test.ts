import { describe, expect, it } from 'vitest';
import { barrierChains } from '../../core/drive/barriers';
import { getDefaultTrack } from '../../core/drive/track';
import { barrierWallGeometry } from './trackGeometry';

describe('bariyer duvarı', () => {
  const chain = barrierChains(getDefaultTrack())[1];
  const red = [1, 0, 0];
  const white = [1, 1, 1];
  const g = barrierWallGeometry(chain, 0.8, 1.2, [red, white]);
  const pos = g.getAttribute('position');
  const col = g.getAttribute('color');

  it('segment başına 3 yüz (2 üçgen), renkler sırayla', () => {
    expect(pos.count).toBe(chain.length * 18);
    expect(col.getY(0)).toBe(0);
    expect(col.getY(18)).toBe(1);
  });

  it('komşu segmentler eklemde aynı köşeleri paylaşır (örtüşme yok -> titreme yok)', () => {
    // i. segmentin iç yüzü bitiş köşesi = (i+1). segmentin iç yüzü başlangıç köşesi
    for (const i of [0, 5, chain.length - 2]) {
      const endB = i * 18 + 1;
      const startNext = (i + 1) * 18;
      expect(pos.getX(endB)).toBeCloseTo(pos.getX(startNext), 6);
      expect(pos.getZ(endB)).toBeCloseTo(pos.getZ(startNext), 6);
    }
  });
});
