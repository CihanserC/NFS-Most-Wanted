import { describe, expect, it } from 'vitest';
import { Group, Mesh, MeshStandardMaterial, Object3D, BoxGeometry, type Material } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getCar } from '../../data/cars';
import { loadManifest } from '../manifest/load';
import { boxMesh, buildGlb, type GlbMaterial, type GlbNode } from './glbWriter';
import {
  analyzeModel,
  applyModelState,
  bindSharedMaterials,
  isEmptyOption,
  normalizeName,
  parseObjectName,
  slotsNeedingPlaceholder,
} from './modelRules';

const car = getCar('vanta_stallion_70');
const manifest = car.manifest;
const stockParts = Object.fromEntries(
  Object.entries(manifest.slots).map(([id, s]) => [id, s.default]),
);

const named = (name: string, ...children: Object3D[]) => {
  const o = new Group();
  o.name = name;
  for (const c of children) o.add(c);
  return o;
};

describe('nesne adı çözümleme', () => {
  it('slot__seçenek, gövde ve tekerlek çapası tanınır', () => {
    expect(parseObjectName('hood__shaker_scoop')).toEqual({
      kind: 'option',
      slot: 'hood',
      option: 'shaker_scoop',
    });
    expect(parseObjectName('bumper_front__chrome_delete')).toMatchObject({
      slot: 'bumper_front',
      option: 'chrome_delete',
    });
    expect(parseObjectName('body__main')).toEqual({ kind: 'body', part: 'main' });
    expect(parseObjectName('wheel_anchor_FL')).toEqual({ kind: 'anchor', wheel: 'FL' });
  });

  it('Blender kopya eki atılır, geçersiz adlar other olur', () => {
    expect(normalizeName('hood__stock.001')).toBe('hood__stock');
    expect(parseObjectName('hood__stock.002')).toMatchObject({ kind: 'option', option: 'stock' });
    for (const bad of ['Cube', 'hood_stock', '__x', 'Hood__Stock', 'hood__', 'wheel_anchor_XX', ''])
      expect(parseObjectName(bad).kind).toBe('other');
  });
});

describe('model analizi (sentetik sahne)', () => {
  const sceneWith = (names: string[]) => {
    const root = new Group();
    for (const n of names) root.add(named(n));
    return root;
  };

  it('gövde yoksa kullanılamaz ve uyarı verir', () => {
    const a = analyzeModel(sceneWith(['hood__stock']), manifest);
    expect(a.usable).toBe(false);
    expect(a.warnings.some((w) => w.code === 'no_body')).toBe(true);
  });

  it('seçenekler eşlenir, bilinmeyen slot/seçenek uyarı verir', () => {
    const a = analyzeModel(
      sceneWith(['body__main', 'hood__stock', 'hood__shaker_scoop', 'hood__ucan_tabak', 'ucak__x']),
      manifest,
    );
    expect(a.usable).toBe(true);
    expect(Object.keys(a.options.hood ?? {}).sort()).toEqual(['shaker_scoop', 'stock']);
    expect(a.unknown).toEqual(['hood__ucan_tabak', 'ucak__x']);
    expect(a.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(['unknown_option', 'unknown_slot', 'missing_option']),
    );
  });

  it('adlandırılmış nesnenin çocukları ayrı seçenek sayılmaz, grup birlikte yönetilir', () => {
    const inner = named('hood__stock');
    const root = new Group();
    root.add(named('body__main'), named('hood__shaker_scoop', inner));
    const a = analyzeModel(root, manifest);
    expect(a.options.hood?.shaker_scoop).toHaveLength(1);
    expect(a.options.hood?.stock).toBeUndefined();
  });

  it('boş sayılan seçenekler (none, modelEmptyOptions) için missing_option uyarısı yok', () => {
    const a = analyzeModel(sceneWith(['body__main']), manifest);
    const missing = a.warnings.filter((w) => w.code === 'missing_option');
    expect(missing.some((w) => w.slot === 'spoiler_rear' && w.option === 'none')).toBe(false);
    expect(missing.some((w) => w.slot === 'spoiler_rear' && w.option === 'ducktail')).toBe(true);
    const withEmpty = loadManifest(
      { ...manifestJson(), modelEmptyOptions: { fenders: ['stock'] } },
      'test',
    );
    expect(isEmptyOption(withEmpty, 'fenders', 'stock')).toBe(true);
    expect(isEmptyOption(withEmpty, 'fenders', 'widebody')).toBe(false);
  });

  it('çapa konumları okunur; manifestten uzaksa anchor_mismatch uyarısı', () => {
    const root = new Group();
    root.add(named('body__main'));
    const [x, y, z] = manifest.wheels.FL.position;
    const good = named('wheel_anchor_FL');
    good.position.set(x, y, z);
    const bad = named('wheel_anchor_FR');
    bad.position.set(-1.2, 0.5, 1.6);
    root.add(good, bad);
    const a = analyzeModel(root, manifest);
    expect(a.anchors.FL?.x).toBeCloseTo(x);
    expect(a.warnings.filter((w) => w.code === 'anchor_mismatch')).toHaveLength(1);
    expect(a.warnings.filter((w) => w.code === 'anchor_missing')).toHaveLength(2); // RL, RR
  });

  it('görünürlük: yalnızca seçili seçenek görünür; motor sadece blower kesikte', () => {
    const root = new Group();
    root.add(
      named('body__main'),
      named('hood__stock'),
      named('hood__blower_cutout'),
      named('engine__stock_v8'),
    );
    const a = analyzeModel(root, manifest);
    const hood = (o: string) => a.options.hood?.[o]?.[0];
    const engine = a.options.engine?.stock_v8?.[0];
    applyModelState(a, stockParts);
    expect(hood('stock')?.visible).toBe(true);
    expect(hood('blower_cutout')?.visible).toBe(false);
    expect(engine?.visible).toBe(false);
    applyModelState(a, { ...stockParts, hood: 'blower_cutout' });
    expect(hood('stock')?.visible).toBe(false);
    expect(hood('blower_cutout')?.visible).toBe(true);
    expect(engine?.visible).toBe(true);
  });

  it('placeholder gereken slotlar: modelde nesnesi olmayan mevcut seçenekler', () => {
    const root = new Group();
    root.add(named('body__main'), named('hood__stock'), named('grille__stock'));
    const a = analyzeModel(root, manifest);
    const need = slotsNeedingPlaceholder(a, manifest, stockParts);
    expect(need).not.toContain('hood');
    expect(need).not.toContain('grille');
    expect(need).toContain('bumper_front');
    expect(need).not.toContain('spoiler_rear'); // none: geometri gerekmez
    expect(need).not.toContain('engine'); // blower kesik değil: motor görünmez
    // Seçenek değişince ilgili slot için placeholder gerekir
    expect(slotsNeedingPlaceholder(a, manifest, { ...stockParts, hood: 'shaker_scoop' })).toContain(
      'hood',
    );
  });
});

describe('materyal bağlama', () => {
  it('adı tanınan materyaller paylaşılanla değişir, diğerleri kalır', () => {
    const shared = new Map<string, Material>([
      ['paint_body', new MeshStandardMaterial({ name: 'paint_body' })],
      ['mat_chrome', new MeshStandardMaterial({ name: 'mat_chrome' })],
    ]);
    const own = new MeshStandardMaterial({ name: 'ozel_kaplama' });
    const root = new Group();
    const a = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'paint_body.001' }));
    const b = new Mesh(new BoxGeometry(), [new MeshStandardMaterial({ name: 'mat_chrome' }), own]);
    root.add(a, b);
    const result = bindSharedMaterials(root, shared);
    expect(a.material).toBe(shared.get('paint_body'));
    expect((b.material as Material[])[0]).toBe(shared.get('mat_chrome'));
    expect((b.material as Material[])[1]).toBe(own);
    expect(result.replaced.sort()).toEqual(['mat_chrome', 'paint_body']);
    expect(result.unknown).toEqual(['ozel_kaplama']);
  });
});

function manifestJson() {
  // Test için manifestin düz kopyası
  return JSON.parse(JSON.stringify(manifest)) as Record<string, unknown>;
}

describe('GLB uçtan uca (GLTFLoader ile)', () => {
  const materials: GlbMaterial[] = [
    { name: 'paint_body', color: [0.8, 0.1, 0.1] },
    { name: 'mat_chrome', color: [0.9, 0.9, 0.9], metallic: 1 },
    { name: 'mat_glass', color: [0.1, 0.15, 0.2, 0.4] },
  ];
  const mesh = (
    material: string,
    size: [number, number, number],
    at: [number, number, number],
  ) => ({
    ...boxMesh(size, at),
    material,
  });

  function parse(nodes: GlbNode[]): Promise<Object3D> {
    const buffer = buildGlb(nodes, materials);
    return new Promise((resolve, reject) =>
      new GLTFLoader().parse(buffer, '', (gltf) => resolve(gltf.scene), reject),
    );
  }

  const conforming = (): GlbNode[] => [
    { name: 'body__main', mesh: mesh('paint_body', [1.8, 0.7, 4.7], [0, 0.6, 0]) },
    { name: 'hood__stock', mesh: mesh('paint_body', [1.2, 0.1, 1.5], [0, 1, 1.3]) },
    { name: 'hood__shaker_scoop', mesh: mesh('paint_body', [0.5, 0.2, 0.6], [0, 1.1, 1]) },
    { name: 'grille__stock', mesh: mesh('mat_chrome', [1, 0.3, 0.05], [0, 0.6, 2.4]) },
    {
      name: 'wheel_anchor_FL',
      translation: [...manifest.wheels.FL.position] as [number, number, number],
    },
  ];

  it('GLB yüklenir, adlar korunur ve analiz beklenen sonucu verir', async () => {
    const scene = await parse(conforming());
    const a = analyzeModel(scene, manifest);
    expect(a.usable).toBe(true);
    expect(a.bodyObjects).toHaveLength(1);
    expect(Object.keys(a.options.hood ?? {}).sort()).toEqual(['shaker_scoop', 'stock']);
    expect(a.options.grille?.stock).toHaveLength(1);
    expect(a.anchors.FL?.toArray().map((v) => +v.toFixed(3))).toEqual(
      manifest.wheels.FL.position.map((v) => +v.toFixed(3)),
    );
    expect(a.warnings.some((w) => w.code === 'anchor_mismatch')).toBe(false);
  });

  it('eksik parçalar için placeholder, mevcut parçalar için model kullanılır', async () => {
    const scene = await parse(conforming());
    const a = analyzeModel(scene, manifest);
    const need = slotsNeedingPlaceholder(a, manifest, stockParts);
    expect(need).toContain('bumper_front'); // modelde yok
    expect(need).not.toContain('hood');
    expect(need).not.toContain('grille');
    applyModelState(a, { ...stockParts, hood: 'shaker_scoop' });
    expect(a.options.hood?.shaker_scoop?.[0]?.visible).toBe(true);
    expect(a.options.hood?.stock?.[0]?.visible).toBe(false);
  });

  it('gövdesiz GLB kullanılamaz sayılır (tamamen placeholder)', async () => {
    const scene = await parse(conforming().filter((n) => n.name !== 'body__main'));
    expect(analyzeModel(scene, manifest).usable).toBe(false);
  });

  it('GLB içindeki adlı materyaller paylaşılan materyallerle değişir', async () => {
    const scene = await parse(conforming());
    const paint = new MeshStandardMaterial({ name: 'paint_body' });
    const chrome = new MeshStandardMaterial({ name: 'mat_chrome' });
    const result = bindSharedMaterials(
      scene,
      new Map<string, Material>([
        ['paint_body', paint],
        ['mat_chrome', chrome],
      ]),
    );
    expect(result.replaced.sort()).toEqual(['mat_chrome', 'paint_body']);
    const body = scene.getObjectByName('body__main') as Mesh;
    expect(body.material).toBe(paint);
  });
});
