import { describe, expect, it } from 'vitest';
import { Box3, Vector3, type Mesh } from 'three';
import { loadGlbScene, sharedTestMaterials } from './glbTestUtils';
import { sampleSurface } from './surfaceMap';
import { sample2 } from '../surface';
import { defaultParts } from '../../core/build/build';
import { slotsNeedingPlaceholder } from '../../core/model/modelRules';
import { prepareModel } from '../../core/model/prepareModel';
import { getCar } from '../../data/cars';
import { axleBodies } from '../fitmentBody';

const car = getCar('ford_mustang_gt_2013');
const GLB = new URL('../../../public/assets/cars/ford_mustang_gt_2013.glb', import.meta.url);

const shared = sharedTestMaterials;
const loadScene = () => loadGlbScene(GLB);

describe('2013 Ford Mustang GT (gerçek GLB)', () => {
  it('manifest araç kayıt defterinde ve model yolu public altında', () => {
    expect(car.manifest.model).toBe('assets/cars/ford_mustang_gt_2013.glb');
    expect(car.modelMap).toBeDefined();
    expect(car.manifest.paintZones).toEqual(['body', 'hood', 'roof', 'doors', 'trunk', 'bumpers']);
  });

  it('eşleme sonrası model gerçek ölçülerde ve zemin hizasında', async () => {
    const prepared = prepareModel(await loadScene(), car.manifest, shared, car.modelMap);
    prepared.root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(prepared.root);
    const size = box.getSize(new Vector3());
    expect(size.x).toBeGreaterThan(1.95);
    expect(size.x).toBeLessThan(2.1);
    // Lastikler ("undercover" ağı) gizlendiği için yükseklik gövde: ≈1,25 m
    expect(size.y).toBeGreaterThan(1.15);
    expect(size.y).toBeLessThan(1.45);
    expect(size.z).toBeGreaterThan(4.7);
    expect(size.z).toBeLessThan(4.85);
    // Zemin: araç tabanı y≈0 (alt plaka gizlendi), tekerlek merkezleri manifestle uyumlu
    expect(box.min.y).toBeGreaterThan(-0.05);
    expect(box.min.y).toBeLessThan(0.25);
    // Ön +Z: kaput burnu +Z'de
    expect(box.max.z).toBeGreaterThan(2.3);
  });

  it('tekerlek/disk/fren ve alt plaka gizlenir, geri kalanı korunur', async () => {
    const prepared = prepareModel(await loadScene(), car.manifest, shared, car.modelMap);
    const names: string[] = [];
    prepared.root.traverse((o) => {
      if ('isMesh' in o && o.isMesh) names.push(o.name);
    });
    expect(names.length).toBeGreaterThan(100);
    for (const hidden of ['SM_Hub_', 'SM_Disk_', 'SM_Brake_', 'undercover'])
      expect(names.some((n) => n.includes(hidden))).toBe(false);
    expect(names.some((n) => n.includes('SM_Hood'))).toBe(true);
    expect(names.some((n) => n.includes('ANC_Door'))).toBe(true);
  });

  it('boya bölgeleri: kaput, kapılar; tek mesh arka kit tavan/bagaj/tampon/gövdeye, ön kit tampon/gövdeye bölünür', async () => {
    const prepared = prepareModel(await loadScene(), car.manifest, shared, car.modelMap);
    /** Bölge -> o bölgeye düşen üçgen sayısı (geometri gruplarından) */
    const zoneTris = (needle: string) => {
      const out = new Map<string, number>();
      prepared.root.traverse((o) => {
        if (!('isMesh' in o) || !o.isMesh || !o.name.includes(needle)) return;
        const mesh = o as Mesh;
        const mats = [mesh.material].flat();
        const groups = mesh.geometry.groups.length
          ? mesh.geometry.groups
          : [{ start: 0, count: mesh.geometry.index?.count ?? 0, materialIndex: 0 }];
        for (const g of groups) {
          const name = mats[g.materialIndex ?? 0]?.name ?? '?';
          out.set(name, (out.get(name) ?? 0) + g.count / 3);
        }
      });
      return out;
    };
    expect(zoneTris('SM_Hood').has('paint_hood')).toBe(true);
    expect(zoneTris('ANC_Door').has('paint_doors')).toBe(true);
    const rear = zoneTris('SM_RearKit');
    for (const z of ['paint_roof', 'paint_trunk', 'paint_bumpers', 'paint_body'])
      expect(rear.get(z) ?? 0, z).toBeGreaterThan(200);
    const front = zoneTris('SM_FrontKit');
    expect(front.get('paint_bumpers') ?? 0).toBeGreaterThan(500);
    expect(front.get('paint_body') ?? 0).toBeGreaterThan(500);
    expect(prepared.binding.replaced.sort()).toEqual(
      expect.arrayContaining(['mat_glass', 'paint_body', 'paint_hood', 'paint_roof']),
    );
    expect(prepared.warnings.some((w) => w.code === 'unknown_paint_zone')).toBe(false);
  });

  it('stok kurulumda yedek parça gerekmez; overlay seçenekleri yalnız kendi slotunu çizer', async () => {
    const prepared = prepareModel(await loadScene(), car.manifest, shared, car.modelMap);
    const stock = defaultParts(car.manifest);
    expect(prepared.analysis.usable).toBe(true);
    expect(slotsNeedingPlaceholder(prepared.analysis, car.manifest, stock)).toEqual([]);
    expect(
      slotsNeedingPlaceholder(prepared.analysis, car.manifest, {
        ...stock,
        hood: 'shaker_scoop',
        spoiler_rear: 'ducktail',
      }).sort(),
    ).toEqual(['hood', 'spoiler_rear']);
  });

  it('yüzey haritası (surface.json) modelle güncel: örnek noktalarda ±1 cm', async () => {
    const prepared = prepareModel(await loadScene(), car.manifest, shared, car.modelMap);
    const fresh = sampleSurface(prepared.root);
    const stored = car.surface;
    expect(stored).toBeDefined();
    // Model/eşleme değişip harita yeniden üretilmediyse burası kırılır (bkz. surface.gen.test.ts)
    for (const [z, x] of [
      [2.05, 0.55],
      [1.3, 0],
      [-2.1, 0.3],
      [-0.4, 0],
      [0.5, 0.7],
    ] as const) {
      const a = sample2(fresh.top, z, x);
      const b = sample2(stored!.top, z, x);
      expect(a).not.toBeNull();
      expect(Math.abs((a ?? 0) - (b ?? 0))).toBeLessThan(0.01);
    }
    expect(fresh.nose.values).toEqual(stored!.nose.values);
  });

  it('çapa uyarısı eşlemeli modellerde gürültü yapmaz', async () => {
    const prepared = prepareModel(await loadScene(), car.manifest, shared, car.modelMap);
    expect(prepared.warnings.some((w) => w.code === 'anchor_missing')).toBe(false);
  });
});

describe('Mustang manifest verisi', () => {
  it('tekerlek konumları ve aks mesafesi modelden ölçülenle tutarlı', () => {
    const { wheels, dimensions } = car.manifest;
    expect(wheels.FL.position[2] - wheels.RL.position[2]).toBeCloseTo(dimensions.wheelbase, 2);
    expect(wheels.FL.position[0]).toBeCloseTo(0.727, 3);
    expect(wheels.FL.position[0]).toBeCloseTo(-wheels.FR.position[0], 5);
  });

  it('stok jant/lastik modern (19" gunmetal) ve fitment ölçüleri manifestten gelir', () => {
    const parts = defaultParts(car.manifest);
    const bodies = axleBodies(car, parts);
    expect(bodies.front.fenderX).toBeCloseTo(0.9, 3);
    expect(bodies.rear.fenderX).toBeCloseTo(0.93, 3);
    expect(car.manifest.defaultFitment?.wheels?.front?.diameterIn).toBe(19);
  });
});
