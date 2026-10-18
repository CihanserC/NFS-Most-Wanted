import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { getCar } from '../../data/cars';
import { createDefaultBuild, withLook, withPart, withPerformance } from '../build/build';
import { createLayer } from '../vinyl/layers';
import {
  AUTOSAVE_ID,
  autosaveId,
  BUILD_FILE_FORMAT,
  buildFromSlot,
  cleanName,
  deleteBuildSlot,
  exportBuildJson,
  exportFileName,
  GarageError,
  importBuildJson,
  listBuilds,
  loadAutosave,
  loadBuildSlot,
  saveAutosave,
  saveBuild,
  SLOT_LIMIT,
} from './garageService';
import {
  createIdbStorage,
  createMemoryStorage,
  openGarageStorage,
  type GarageStorage,
} from './garageStorage';

const car = getCar('vanta_stallion_70');
const manifest = car.manifest;
const base = createDefaultBuild(manifest);

const backends: [string, () => GarageStorage][] = [
  ['IndexedDB', () => createIdbStorage(new IDBFactory())],
  ['bellek yedeği', () => createMemoryStorage()],
];

describe.each(backends)('garaj depolama (%s)', (_name, make) => {
  it('kaydet, listele, yükle: build birebir geri gelir (vinil, duruş, performans dahil)', async () => {
    const storage = make();
    const layer = createLayer('circle', 'left', [0.5, 0.5]);
    let b = withPart(base, 'hood', 'shaker_scoop');
    b = withLook(b, { stance: { ...b.stance, rideHeightMm: { front: -40, rear: -30 } } });
    b = withPerformance(b, { engine: 'race' });
    b = { ...b, name: 'Gece Avcısı', vinyl: [layer] };
    const slot = await saveBuild(storage, b, { thumbnail: 'data:image/jpeg;base64,AAA' });
    const list = await listBuilds(storage);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: slot.id,
      name: 'Gece Avcısı',
      thumbnail: 'data:image/jpeg;base64,AAA',
    });
    const loaded = await loadBuildSlot(storage, slot.id, manifest);
    expect(loaded.parts.hood).toBe('shaker_scoop');
    expect(loaded.stance.rideHeightMm).toEqual({ front: -40, rear: -30 });
    expect(loaded.performance.engine).toBe('race');
    expect(loaded.vinyl).toHaveLength(1);
    expect(loaded.name).toBe('Gece Avcısı');
  });

  it('aynı slota yazınca günceller; yeni görsel verilmezse eskisi korunur', async () => {
    const storage = make();
    const first = await saveBuild(storage, { ...base, name: 'A' }, { thumbnail: 'data:t1' });
    await saveBuild(storage, { ...base, name: 'B' }, { id: first.id });
    const list = await listBuilds(storage);
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('B');
    expect(list[0]?.thumbnail).toBe('data:t1');
  });

  it('en son güncellenen önce gelir, otomatik kayıt listede görünmez', async () => {
    const storage = make();
    await saveBuild(storage, { ...base, name: 'Eski' }, { now: new Date('2026-01-01') });
    await saveBuild(storage, { ...base, name: 'Yeni' }, { now: new Date('2026-06-01') });
    await saveAutosave(storage, base);
    const list = await listBuilds(storage);
    expect(list.map((s) => s.name)).toEqual(['Yeni', 'Eski']);
    expect(list.some((s) => s.id === AUTOSAVE_ID)).toBe(false);
  });

  it('silme slotu kaldırır; olmayan slot yüklenemez', async () => {
    const storage = make();
    const slot = await saveBuild(storage, base);
    await deleteBuildSlot(storage, slot.id);
    expect(await listBuilds(storage)).toHaveLength(0);
    await expect(loadBuildSlot(storage, slot.id, manifest)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('slot sınırı aşılınca slot_limit, mevcut slota yazmak yine serbest', async () => {
    const storage = make();
    let last = '';
    for (let i = 0; i < SLOT_LIMIT; i++) last = (await saveBuild(storage, base)).id;
    await expect(saveBuild(storage, base)).rejects.toMatchObject({ code: 'slot_limit' });
    await expect(saveBuild(storage, base, { id: last })).resolves.toBeDefined();
  });

  it('otomatik kayıt: son durum geri gelir, bozuksa null', async () => {
    const storage = make();
    expect(await loadAutosave(storage, manifest)).toBeNull();
    await saveAutosave(storage, withPart(base, 'spoiler_rear', 'ducktail'));
    expect((await loadAutosave(storage, manifest))?.parts.spoiler_rear).toBe('ducktail');
    // Araç başına slot silinip bozuk eski tek slot bırakılırsa null döner
    await storage.removeSlot(autosaveId(manifest.id));
    await storage.putSlot({
      id: AUTOSAVE_ID,
      name: 'x',
      carId: manifest.id,
      updatedAt: '',
      thumbnail: null,
      json: JSON.stringify({ ...base, version: 999 }),
    });
    expect(await loadAutosave(storage, manifest)).toBeNull();
  });

  it('meta değerleri yazılır ve okunur', async () => {
    const storage = make();
    expect(await storage.getMeta('x')).toBeNull();
    await storage.setMeta('x', { a: [1, 2] });
    expect(await storage.getMeta('x')).toEqual({ a: [1, 2] });
  });
});

describe('kalıcılık (sayfa yenileme)', () => {
  it('aynı IndexedDB fabrikası yeni bir depo örneğiyle de aynı veriyi görür', async () => {
    const factory = new IDBFactory();
    const slot = await saveBuild(createIdbStorage(factory), { ...base, name: 'Kalıcı' });
    const reopened = createIdbStorage(factory);
    expect((await listBuilds(reopened)).map((s) => s.id)).toEqual([slot.id]);
  });

  it('IndexedDB yoksa bellek yedeğine düşer', async () => {
    expect((await openGarageStorage(undefined)).kind).toBe('memory');
  });
});

describe('JSON dışa/içe aktarma', () => {
  it('dışa aktarılan JSON içe aktarılınca aynı build gelir', () => {
    const b = withPerformance(withPart({ ...base, name: 'Paylaş' }, 'grille', 'billet'), {
      suspension: 'stiff',
    });
    const json = exportBuildJson(b);
    expect(JSON.parse(json).format).toBe(BUILD_FILE_FORMAT);
    const back = importBuildJson(json, manifest);
    expect(back.parts.grille).toBe('billet');
    expect(back.performance.suspension).toBe('stiff');
    expect(back.name).toBe('Paylaş');
  });

  it('çıplak BuildState JSON da kabul edilir (eski sürümler migration ile)', () => {
    const old = { ...base, version: 3 } as Record<string, unknown>;
    delete old.vinyl;
    delete old.stance;
    delete old.glass;
    delete old.lighting;
    delete old.performance;
    const back = importBuildJson(JSON.stringify(old), manifest);
    expect(back.version).toBe(base.version);
    expect(back.performance).toBeDefined();
  });

  it('hatalı girişler anlaşılır kodla reddedilir', () => {
    const code = (text: string) => {
      try {
        importBuildJson(text, manifest);
      } catch (e) {
        return e instanceof GarageError ? e.code : 'baska';
      }
      return 'ok';
    };
    expect(code('{bozuk')).toBe('invalid_json');
    expect(code('42')).toBe('corrupt');
    expect(code(JSON.stringify({ ...base, carId: 'baska' }))).toBe('wrong_car');
    expect(code(JSON.stringify({ ...base, version: 999 }))).toBe('corrupt');
  });

  it('dosya adı Türkçe karakterlerden arındırılır', () => {
    expect(exportFileName({ ...base, name: 'Şahin Çıkışı!' })).toBe(
      'sahin-cikisi.muscle-garage.json',
    );
    expect(exportFileName({ ...base, name: '***' })).toBe('build.muscle-garage.json');
  });

  it('isim temizleme: boşluk kırpılır, boşsa varsayılan, uzunsa kesilir', () => {
    expect(cleanName('  Abc  ')).toBe('Abc');
    expect(cleanName('   ')).toBe(base.name);
    expect(cleanName('x'.repeat(100))).toHaveLength(40);
  });

  it('bozuk slot corrupt hatası verir', () => {
    expect(() =>
      buildFromSlot(
        { id: 'a', name: 'a', carId: manifest.id, updatedAt: '', thumbnail: null, json: '{' },
        manifest,
      ),
    ).toThrow(GarageError);
  });
});
