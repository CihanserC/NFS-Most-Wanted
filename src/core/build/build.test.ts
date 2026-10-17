import { describe, expect, it } from 'vitest';
import { getCar } from '../../data/cars';
import { createDefaultBuild, normalizeParts, withFitment, withPaint, withPart } from './build';
import { emptyHistory, record, redo, undo } from './history';
import { BuildMigrationError, migrateBuild } from './migrate';
import { deserializeBuild, serializeBuild } from './serialize';
import { CURRENT_BUILD_VERSION } from './types';

const { manifest } = getCar('vanta_stallion_70');

describe('BuildState', () => {
  it('varsayılan build her slot için manifest varsayılanını içerir', () => {
    const b = createDefaultBuild(manifest);
    expect(b.version).toBe(CURRENT_BUILD_VERSION);
    expect(Object.keys(b.paint).sort()).toEqual([...manifest.paintZones].sort());
    expect(Object.keys(b.parts).sort()).toEqual(Object.keys(manifest.slots).sort());
    expect(b.parts.hood).toBe('stock');
  });

  it('normalizeParts geçersiz seçenekleri varsayılana çeker, bilinmeyen slotları atar', () => {
    const parts = normalizeParts({ hood: 'carbon', grille: 'mesh', jetpack: 'yes' }, manifest);
    expect(parts.hood).toBe('stock');
    expect(parts.grille).toBe('mesh');
    expect(parts).not.toHaveProperty('jetpack');
    expect(parts.roof).toBe('painted');
  });

  it("JSON gidiş-dönüş build'i korur", () => {
    const b = withPart(createDefaultBuild(manifest), 'hood', 'shaker_scoop');
    expect(deserializeBuild(serializeBuild(b), manifest)).toEqual(b);
  });

  it('başka araca ait kaydı reddeder', () => {
    const b = { ...createDefaultBuild(manifest), carId: 'other_car' };
    expect(() => deserializeBuild(serializeBuild(b), manifest)).toThrow(/other_car/);
  });
});

describe('migration', () => {
  it('v0 kaydını güncel sürüme taşır', () => {
    const migrated = migrateBuild({
      version: 0,
      carId: 'vanta_stallion_70',
      name: 'Eski',
      slots: { hood: 'cowl_induction' },
    });
    expect(migrated.version).toBe(CURRENT_BUILD_VERSION);
    expect(migrated.parts).toEqual({ hood: 'cowl_induction' });
    expect(migrated.paint).toEqual({});
    expect(migrated).not.toHaveProperty('slots');
  });

  it('v1 kaydının boyası varsayılanla dolar', () => {
    const v1 = {
      version: 1,
      carId: 'vanta_stallion_70',
      name: 'Eski',
      parts: { hood: 'shaker_scoop' },
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const b = deserializeBuild(JSON.stringify(v1), manifest);
    expect(b.version).toBe(CURRENT_BUILD_VERSION);
    expect(b.parts.hood).toBe('shaker_scoop');
    expect(Object.keys(b.paint).sort()).toEqual([...manifest.paintZones].sort());
  });

  it('boyalı build JSON gidiş-dönüşünde boya korunur', () => {
    const base = createDefaultBuild(manifest);
    const b = withPaint(base, { roof: { ...base.paint.roof!, type: 'chameleon' } });
    expect(deserializeBuild(serializeBuild(b), manifest).paint.roof?.type).toBe('chameleon');
  });

  it('v2 kaydına varsayılan jant/lastik/fren eklenir, boya korunur', () => {
    const base = createDefaultBuild(manifest);
    const { wheels: _w, tires: _t, brakes: _b, vinyl: _v, ...v2 } = { ...base, version: 2 };
    const b = deserializeBuild(JSON.stringify(v2), manifest);
    expect(b.version).toBe(CURRENT_BUILD_VERSION);
    expect(b.wheels).toEqual(base.wheels);
    expect(b.tires).toEqual(base.tires);
    expect(b.brakes).toEqual(base.brakes);
    expect(b.paint).toEqual(base.paint);
  });

  it('jant/lastik/fren JSON gidiş-dönüşünde korunur', () => {
    const base = createDefaultBuild(manifest);
    const b = withFitment(base, {
      wheels: {
        front: { ...base.wheels.front, style: 'mesh', diameterIn: 18 },
        rear: base.wheels.rear,
      },
      brakes: { ...base.brakes, rotor: 'drilled', pistons: 6 },
    });
    const back = deserializeBuild(serializeBuild(b), manifest);
    expect(back.wheels.front.style).toBe('mesh');
    expect(back.brakes.pistons).toBe(6);
    expect(back).toEqual(b);
  });

  it('gelecekteki sürümü ve sürümsüz kaydı reddeder', () => {
    expect(() => migrateBuild({ version: 99 })).toThrow(BuildMigrationError);
    expect(() => migrateBuild({ carId: 'x' })).toThrow(BuildMigrationError);
    expect(() => migrateBuild('nope')).toThrow(BuildMigrationError);
  });
});

describe('history', () => {
  it('undo/redo sırasını korur', () => {
    let h = emptyHistory<number>();
    h = record(h, 1);
    h = record(h, 2);
    const u = undo(h, 3);
    expect(u?.present).toBe(2);
    const u2 = undo(u!.history, u!.present);
    expect(u2?.present).toBe(1);
    expect(undo(u2!.history, u2!.present)).toBeNull();
    const r = redo(u2!.history, u2!.present);
    expect(r?.present).toBe(2);
  });

  it('yeni kayıt redo yığınını temizler', () => {
    let h = record(emptyHistory<number>(), 1);
    const u = undo(h, 2)!;
    h = record(u.history, u.present);
    expect(h.future).toEqual([]);
  });

  it('limiti aşınca en eski adımları atar', () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < 150; i++) h = record(h, i, 100);
    expect(h.past).toHaveLength(100);
    expect(h.past[0]).toBe(50);
  });
});
