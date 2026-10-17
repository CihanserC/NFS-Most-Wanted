import { describe, expect, it } from 'vitest';
import { getCar } from '../../data/cars';
import { DEFAULT_HISTORY_LIMIT } from '../build/history';
import { createBuildStore } from './buildStore';

const { manifest } = getCar('vanta_stallion_70');

describe('buildStore', () => {
  it('her slottaki her seçenek takılabilir', () => {
    const store = createBuildStore(manifest);
    for (const [slotId, slot] of Object.entries(manifest.slots))
      for (const option of slot.options) {
        store.getState().setPart(slotId, option);
        expect(store.getState().build.parts[slotId]).toBe(option);
      }
  });

  it('parça değiştirme geri alınır ve yinelenir', () => {
    const store = createBuildStore(manifest);
    store.getState().setPart('hood', 'shaker_scoop');
    store.getState().setPart('grille', 'billet');
    store.getState().undo();
    expect(store.getState().build.parts.grille).toBe('stock');
    expect(store.getState().build.parts.hood).toBe('shaker_scoop');
    store.getState().undo();
    expect(store.getState().build.parts.hood).toBe('stock');
    store.getState().redo();
    store.getState().redo();
    expect(store.getState().build.parts).toMatchObject({ hood: 'shaker_scoop', grille: 'billet' });
  });

  it("önizleme geçmişe yazılmaz ve build'i değiştirmez", () => {
    const store = createBuildStore(manifest);
    store.getState().previewPart('spoiler_rear', 'high_wing');
    expect(store.getState().preview).toEqual({ slotId: 'spoiler_rear', optionId: 'high_wing' });
    expect(store.getState().build.parts.spoiler_rear).toBe('none');
    store.getState().clearPreview();
    expect(store.getState().preview).toBeNull();
    expect(store.getState().history.past).toHaveLength(0);
  });

  it('onaylama önizlemeyi temizler', () => {
    const store = createBuildStore(manifest);
    store.getState().previewPart('roof', 'vinyl_top');
    store.getState().setPart('roof', 'vinyl_top');
    expect(store.getState().preview).toBeNull();
  });

  it('aynı parçayı tekrar takmak geçmişe adım eklemez', () => {
    const store = createBuildStore(manifest);
    store.getState().setPart('hood', 'stock');
    expect(store.getState().history.past).toHaveLength(0);
  });

  it('geçersiz parça hata verir, geçersiz önizleme yok sayılır', () => {
    const store = createBuildStore(manifest);
    expect(() => store.getState().setPart('hood', 'jet_engine')).toThrow();
    store.getState().previewPart('hood', 'jet_engine');
    expect(store.getState().preview).toBeNull();
  });

  it('en az 100 adım geri alınabilir', () => {
    const store = createBuildStore(manifest);
    const opts = manifest.slots.hood!.options;
    for (let i = 0; i < 120; i++) store.getState().setPart('hood', opts[(i + 1) % opts.length]!);
    expect(store.getState().history.past).toHaveLength(DEFAULT_HISTORY_LIMIT);
    for (let i = 0; i < 100; i++) store.getState().undo();
    expect(store.getState().history.past).toHaveLength(0);
  });
});
