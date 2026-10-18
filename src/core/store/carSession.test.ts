import { beforeEach, describe, expect, it } from 'vitest';
import { getCar, registerCarForTests, type CarDefinition } from '../../data/cars';
import { createDefaultBuild } from '../build/build';
import { serializeBuild } from '../build/serialize';
import {
  AUTOSAVE_ID,
  autosaveId,
  listBuilds,
  loadAllAutosaves,
  saveAutosave,
  saveBuild,
} from '../storage/garageService';
import { createMemoryStorage } from '../storage/garageStorage';
import {
  flushAutosave,
  initPersistence,
  readLastCar,
  resetPersistenceForTests,
} from '../storage/persistence';
import { useAppStore } from './appStore';
import { buildForCar, enterCar, leaveToSelect, previewCar } from './carSession';
import { useGarageStore } from './garageStore';
import { useBuildStore } from './stores';

const vanta = getCar('vanta_stallion_70');
/** İkinci araç: Vanta'nın klonu, farklı kimlik/ad/kütle (çok araçlı akış testi). */
const second: CarDefinition = {
  ...vanta,
  manifest: {
    ...vanta.manifest,
    id: 'test_second_car',
    displayName: 'Test İkinci Araç',
    massKg: 1400,
  },
};
registerCarForTests(second);

const build = () => useBuildStore.getState().build;
const garage = () => useGarageStore.getState();

beforeEach(async () => {
  resetPersistenceForTests();
  useGarageStore.setState({ autosaves: {}, slots: [], currentSlotId: null, notice: null });
  useBuildStore.getState().setCar(createDefaultBuild(vanta.manifest));
  useAppStore.getState().setMode('select');
  await initPersistence(createMemoryStorage());
});

describe('araç oturumu', () => {
  it('previewCar aracı değiştirir: manifest, build ve geçmiş sıfırlanır; kullanıcı değişikliği sayılmaz', async () => {
    useBuildStore.getState().setPart('hood', 'cowl_induction');
    await previewCar(second.manifest.id);
    expect(useBuildStore.getState().manifest.id).toBe('test_second_car');
    expect(build().carId).toBe('test_second_car');
    expect(useBuildStore.getState().history.past).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 900));
    // Dokunulmamış araç için otomatik kayıt oluşmaz ("kayıtlı proje var" yalanı olmasın)
    expect(garage().autosaves['test_second_car']).toBeUndefined();
  });

  it('enterCar atölyeye geçer, son aracı anımsar ve araç başına oturum saklar', async () => {
    await enterCar('vanta_stallion_70');
    expect(useAppStore.getState().mode).toBe('garage');
    useBuildStore.getState().setPart('spoiler_rear', 'ducktail');
    await leaveToSelect();
    expect(useAppStore.getState().mode).toBe('select');
    expect(garage().autosaves['vanta_stallion_70']?.build.parts.spoiler_rear).toBe('ducktail');

    await enterCar('test_second_car');
    useBuildStore.getState().setPart('hood', 'shaker_scoop');
    await flushAutosave();
    // İki araç ayrı saklanır
    await previewCar('vanta_stallion_70');
    expect(build().parts.spoiler_rear).toBe('ducktail');
    expect(build().parts.hood).toBe('stock');
    await previewCar('test_second_car');
    expect(build().parts.hood).toBe('shaker_scoop');
    expect(build().parts.spoiler_rear).toBe('none');
    expect(await readLastCar(garage().storage)).toBe('test_second_car');
  });

  it('kayıtlı oturum yoksa stok kurulum gösterilir', () => {
    expect(buildForCar('test_second_car').parts.hood).toBe('stock');
  });
});

describe('garaj ve araç değişimi', () => {
  it('başka araca ait slotu yüklemek aracı da değiştirir', async () => {
    const other = { ...createDefaultBuild(second.manifest), name: 'İkincinin Projesi' };
    const slot = await saveBuild(garage().storage, other);
    await garage().refresh();
    await garage().load(slot.id);
    expect(useBuildStore.getState().manifest.id).toBe('test_second_car');
    expect(build().name).toBe('İkincinin Projesi');
  });

  it("JSON içe aktarma kayıtlı herhangi bir araca ait build'i kabul eder", () => {
    const json = JSON.stringify({
      format: 'muscle-garage-build',
      build: JSON.parse(serializeBuild(createDefaultBuild(second.manifest))),
    });
    garage().importText(json);
    expect(build().carId).toBe('test_second_car');
    garage().importText(
      JSON.stringify({ ...createDefaultBuild(vanta.manifest), carId: 'yok_boyle_arac' }),
    );
    expect(garage().notice).toMatchObject({ kind: 'error', key: 'garage.error.wrong_car' });
  });
});

describe('eski tek slotlu otomatik kayıt göçü', () => {
  it('eski slot ait olduğu aracın slotuna taşınır ve silinir; listede görünmez', async () => {
    const storage = createMemoryStorage();
    const legacy = { ...createDefaultBuild(vanta.manifest), name: 'Eski Oturum' };
    legacy.parts = { ...legacy.parts, grille: 'billet' };
    await storage.putSlot({
      id: AUTOSAVE_ID,
      name: legacy.name,
      carId: legacy.carId,
      updatedAt: '2026-01-01T00:00:00.000Z',
      thumbnail: null,
      json: serializeBuild(legacy),
    });
    const all = await loadAllAutosaves(storage, (id) =>
      id === vanta.manifest.id ? vanta.manifest : undefined,
    );
    expect(all['vanta_stallion_70']?.build.parts.grille).toBe('billet');
    expect(await storage.getSlot(AUTOSAVE_ID)).toBeNull();
    expect(await storage.getSlot(autosaveId('vanta_stallion_70'))).not.toBeNull();
    expect(await listBuilds(storage)).toHaveLength(0);
  });

  it('tanınmayan araca ait ya da bozuk kayıtlar atlanır', async () => {
    const storage = createMemoryStorage();
    await saveAutosave(storage, createDefaultBuild(second.manifest));
    await storage.putSlot({
      id: autosaveId('vanta_stallion_70'),
      name: 'x',
      carId: 'vanta_stallion_70',
      updatedAt: '',
      thumbnail: null,
      json: '{bozuk',
    });
    const all = await loadAllAutosaves(storage, (id) =>
      id === 'test_second_car' ? second.manifest : undefined,
    );
    expect(Object.keys(all)).toEqual(['test_second_car']);
  });
});
