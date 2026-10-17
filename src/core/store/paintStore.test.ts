import { describe, expect, it } from 'vitest';
import { getCar } from '../../data/cars';
import { DEFAULT_PAINT } from '../paint/paint';
import { createBuildStore } from './buildStore';
import { sanitizeUserPresets } from './paintPresetStore';

const { manifest } = getCar('vanta_stallion_70');
const zone = manifest.paintZones[0]!;
const matte = { ...DEFAULT_PAINT, type: 'matte' as const, color: '#223344' };

describe('buildStore boya', () => {
  it('boya değişikliği geri alınır ve yinelenir', () => {
    const store = createBuildStore(manifest);
    store.getState().setPaint({ [zone]: matte });
    expect(store.getState().build.paint[zone]).toEqual(matte);
    store.getState().undo();
    expect(store.getState().build.paint[zone]).toEqual(DEFAULT_PAINT);
    store.getState().redo();
    expect(store.getState().build.paint[zone]).toEqual(matte);
  });

  it('tüm bölgeleri tek adımda boyar', () => {
    const store = createBuildStore(manifest);
    store.getState().setPaint(Object.fromEntries(manifest.paintZones.map((z) => [z, matte])));
    expect(store.getState().history.past).toHaveLength(1);
    for (const z of manifest.paintZones) expect(store.getState().build.paint[z]).toEqual(matte);
  });

  it('önizleme geçmişe yazılmaz; commit tek adım ekler', () => {
    const store = createBuildStore(manifest);
    for (let i = 0; i < 20; i++)
      store.getState().previewPaint({ [zone]: { ...matte, gloss: i / 20 } });
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().build.paint[zone]).toEqual(DEFAULT_PAINT);
    store.getState().commitPaintPreview();
    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().build.paint[zone]?.gloss).toBeCloseTo(19 / 20);
    expect(store.getState().paintPreview).toBeNull();
  });

  it('bilinmeyen bölgeleri yok sayar, aynı boya geçmişe adım eklemez', () => {
    const store = createBuildStore(manifest);
    store.getState().setPaint({ wing: matte });
    store.getState().setPaint({ [zone]: DEFAULT_PAINT });
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().build.paint).not.toHaveProperty('wing');
  });
});

describe('kullanıcı boya presetleri', () => {
  it('bozuk kayıtları ayıklar, boyaları düzeltir', () => {
    const out = sanitizeUserPresets([
      { id: 'a', name: 'Benim', paint: { ...matte, gloss: 5 } },
      { id: 3, name: 'x' },
      'çöp',
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.paint.gloss).toBe(1);
    expect(sanitizeUserPresets(null)).toEqual([]);
  });
});
