import { describe, expect, it } from 'vitest';
import { MeshStandardMaterial, Object3D, type Material } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getCar } from '../../data/cars';
import { boxMesh, buildGlb } from '../../core/model/glbWriter';
import { formatWarnings, prepareModel } from '../../core/model/prepareModel';
import { validateManifest } from '../../core/manifest/validate';
import { axleBodies } from '../fitmentBody';
import { resolveModelUrl } from './modelUrl';

const car = getCar('vanta_stallion_70');
const stockParts = Object.fromEntries(
  Object.entries(car.manifest.slots).map(([id, s]) => [id, s.default]),
);
const manifestCopy = () => JSON.parse(JSON.stringify(car.manifest)) as Record<string, unknown>;

describe('model URL çözümleme', () => {
  it('model yoksa null, manifest yolu public köküne göre tam URL olur', () => {
    expect(resolveModelUrl({ model: null }, '', '/')).toBeNull();
    expect(resolveModelUrl({ model: 'assets/cars/a.glb' }, '', '/')).toBe('/assets/cars/a.glb');
    expect(resolveModelUrl({ model: '/assets/a.glb' }, '', '/oyun/')).toBe('/oyun/assets/a.glb');
    expect(resolveModelUrl({ model: 'https://cdn.example/a.glb' }, '', '/')).toBe(
      'https://cdn.example/a.glb',
    );
  });

  it('geliştirmede ?model= manifesti geçersiz kılar', () => {
    expect(resolveModelUrl({ model: null }, '?model=assets/x.glb', '/')).toBe('/assets/x.glb');
    expect(resolveModelUrl({ model: 'assets/a.glb' }, '?model=assets/x.glb', '/')).toBe(
      '/assets/x.glb',
    );
    expect(resolveModelUrl({ model: null }, '?baska=1', '/')).toBeNull();
  });

  it('varsayılan araçta henüz gerçek model yok (placeholder)', () => {
    expect(car.manifest.model).toBeNull();
  });
});

describe('model hazırlama', () => {
  function parseGlb(): Promise<Object3D> {
    const mesh = (material: string) => ({ ...boxMesh([1, 1, 1]), material });
    const buffer = buildGlb(
      [
        { name: 'body__main', mesh: mesh('paint_body') },
        { name: 'hood__stock', mesh: mesh('paint_trunk') },
        { name: 'grille__stock', mesh: mesh('mat_weird') },
      ],
      [
        { name: 'paint_body', color: [1, 0, 0] },
        { name: 'paint_trunk', color: [0, 1, 0] },
        { name: 'mat_weird', color: [0, 0, 1] },
      ],
    );
    return new Promise((resolve, reject) =>
      new GLTFLoader().parse(buffer, '', (g) => resolve(g.scene), reject),
    );
  }

  it('klonlar, paylaşılan materyalleri bağlar, tanınmayan paint_/mat_ adlarını uyarır', async () => {
    const scene = await parseGlb();
    const shared = new Map<string, Material>([
      ['paint_body', new MeshStandardMaterial({ name: 'paint_body' })],
    ]);
    const prepared = prepareModel(scene, car.manifest, shared);
    expect(prepared.root).not.toBe(scene); // orijinal (önbellek) korunur
    expect(prepared.analysis.usable).toBe(true);
    expect(prepared.binding.replaced).toEqual(['paint_body']);
    const codes = prepared.warnings.map((w) => w.code);
    expect(codes).toContain('unknown_paint_zone');
    expect(codes).toContain('unknown_material');
    expect(codes).toContain('missing_option');
    // Orijinal sahnedeki materyal değişmedi
    expect(
      (scene.getObjectByName('body__main') as unknown as { material: Material }).material,
    ).not.toBe(shared.get('paint_body'));
  });

  it('uyarı özeti: uyarı yoksa null, varsa kodlu satırlar', () => {
    expect(formatWarnings('a.glb', [])).toBeNull();
    const text = formatWarnings('a.glb', [{ code: 'no_body', message: 'gövde yok' }]) ?? '';
    expect(text).toContain('[Model] a.glb: 1 uyarı');
    expect(text).toContain('[no_body] gövde yok');
  });

  it('aynı slotun eksik seçenekleri tek satırda toplanır', () => {
    const text =
      formatWarnings('a.glb', [
        { code: 'missing_option', message: 'x', slot: 'hood', option: 'stock' },
        { code: 'missing_option', message: 'y', slot: 'hood', option: 'shaker_scoop' },
        { code: 'missing_option', message: 'z', slot: 'grille', option: 'mesh' },
      ]) ?? '';
    expect(text).toContain('3 uyarı');
    expect(text).toContain('hood: modelde yok -> placeholder (stock, shaker_scoop)');
    expect(text.split('\n')).toHaveLength(3); // başlık + 2 slot satırı
  });
});

describe('manifest: gerçek model alanları', () => {
  it('geçerli modelEmptyOptions ve fitment kabul edilir', () => {
    const m = manifestCopy();
    m.modelEmptyOptions = { fenders: ['stock'], roof: ['painted'] };
    m.fitment = {
      front: { fenderX: 0.92, archRadius: 0.4, wellInnerX: 0.62 },
      rear: { fenderX: 0.95, archRadius: 0.42, wellInnerX: 0.64 },
    };
    expect(validateManifest(m).ok).toBe(true);
  });

  it('bilinmeyen slot/seçenek ve eksik/negatif ölçüler anlaşılır hatayla reddedilir', () => {
    const bad = manifestCopy();
    bad.modelEmptyOptions = { yok_slot: ['x'], hood: ['uydurma'] };
    bad.fitment = { front: { fenderX: -1, archRadius: 0.4, wellInnerX: 0.6 }, rear: {} };
    const result = validateManifest(bad);
    expect(result.ok).toBe(false);
    const errors = result.ok ? [] : result.errors.join('\n');
    expect(errors).toContain('modelEmptyOptions.yok_slot');
    expect(errors).toContain('modelEmptyOptions.hood');
    expect(errors).toContain('fitment.front');
    expect(errors).toContain('fitment.rear');
  });
});

describe('fitment: manifestteki gerçek model ölçüleri', () => {
  it('fitment tanımlıysa placeholder örnekleyicisi yerine o kullanılır (flare payı eklenir)', () => {
    const measured = {
      ...car,
      manifest: {
        ...car.manifest,
        fitment: {
          front: { fenderX: 0.9, archRadius: 0.41, wellInnerX: 0.6 },
          rear: { fenderX: 0.95, archRadius: 0.43, wellInnerX: 0.64 },
        },
      },
    };
    const stock = axleBodies(measured, stockParts);
    expect(stock.front).toMatchObject({ fenderX: 0.9, archRadius: 0.41, wellInnerX: 0.6 });
    expect(stock.rear.hubX).toBeCloseTo(Math.abs(car.manifest.wheels.RL.position[0]));
    const flared = axleBodies(measured, { ...stockParts, fenders: 'widebody' });
    expect(flared.rear.fenderX).toBeGreaterThan(stock.rear.fenderX);
    // Manifestte fitment yoksa placeholder ölçüleri kullanılır
    expect(axleBodies(car, stockParts).front.fenderX).not.toBe(0.9);
  });
});
