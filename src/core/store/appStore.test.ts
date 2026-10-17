import { describe, expect, it } from 'vitest';
import { createAppStore } from './appStore';

describe('appStore', () => {
  it('starts in garage mode with turntable on', () => {
    const store = createAppStore();
    expect(store.getState().mode).toBe('garage');
    expect(store.getState().turntable).toBe(true);
  });

  it('switches mode and toggles turntable', () => {
    const store = createAppStore();
    store.getState().setMode('drive');
    store.getState().toggleTurntable();
    expect(store.getState().mode).toBe('drive');
    expect(store.getState().turntable).toBe(false);
  });
});

describe('appStore menü geçmişi', () => {
  it('geri dönülünce son kategori ve slot hatırlanır', () => {
    const store = createAppStore();
    store.getState().selectCategory('body_kit');
    store.getState().selectSlot('hood');
    store.getState().selectSlot(null);
    expect(store.getState().lastSlotId).toBe('hood');
    store.getState().selectCategory(null);
    expect(store.getState().lastCategoryId).toBe('body_kit');
  });
});
