import { describe, expect, it } from 'vitest';
import { listCars } from '../../data/cars';
import { DEFAULT_DRIVING, loadDriving } from './driving';

describe('driving.json', () => {
  it('eksik alanlar varsayılanı alır', () => {
    expect(loadDriving({ lateralMu: 1.2 })).toEqual({ ...DEFAULT_DRIVING, lateralMu: 1.2 });
  });

  it('bilinmeyen alan, aralık dışı değer ve nesne olmayan girdi reddedilir', () => {
    expect(() => loadDriving({ foo: 1 })).toThrow(/bilinmeyen/);
    expect(() => loadDriving({ lateralMu: 5 })).toThrow(/aralığında/);
    expect(() => loadDriving({ frontBrakeBias: '0.6' })).toThrow(/aralığında/);
    expect(() => loadDriving([])).toThrow(/nesne/);
  });

  it('kayıtlı her aracın ayarları geçerli', () => {
    for (const c of listCars()) expect(c.driving.lateralMu).toBeGreaterThan(0);
  });
});
