import { describe, expect, it } from 'vitest';
import { Box3, Raycaster, Vector3, type Mesh } from 'three';
import { defaultParts } from '../../core/build/build';
import { mergeStaticMeshes } from '../../core/model/mergeStatic';
import { slotsNeedingPlaceholder } from '../../core/model/modelRules';
import { prepareModel } from '../../core/model/prepareModel';
import { getCar } from '../../data/cars';
import { sample2 } from '../surface';
import { loadGlbScene, sharedTestMaterials } from './glbTestUtils';

const car = getCar('bmw_m3_gtr_2001');
const GLB = new URL('../../../public/assets/cars/bmw_m3_gtr_2001.glb', import.meta.url);
const prepare = async () =>
  prepareModel(await loadGlbScene(GLB), car.manifest, sharedTestMaterials, car.modelMap);

describe('2001 BMW M3 GTR (gerçek GLB)', () => {
  it('kayıtlı; model gerçek ölçülerde, zeminde, ön +Z', async () => {
    expect(car.manifest.model).toBe('assets/cars/bmw_m3_gtr_2001.glb');
    const prepared = await prepare();
    prepared.root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(prepared.root);
    const size = box.getSize(new Vector3());
    expect(size.z).toBeGreaterThan(4.5);
    expect(size.z).toBeLessThan(4.7);
    expect(size.x).toBeGreaterThan(1.85);
    expect(size.x).toBeLessThan(2);
    // Lastikler gizli: gövde tabanı zeminin biraz üstünde
    expect(box.min.y).toBeGreaterThan(-0.02);
    expect(box.min.y).toBeLessThan(0.2);
    expect(prepared.analysis.usable).toBe(true);
  });

  it('lastik ve jant materyalleri gizlenir (prosedürel tekerlek kullanılır)', async () => {
    const prepared = await prepare();
    const names = new Set<string>();
    prepared.root.traverse((o) => {
      if ('isMesh' in o && o.isMesh)
        for (const m of [(o as Mesh).material].flat()) names.add(m.name);
    });
    for (const hidden of ['tire', 'Rim_Chrome', 'Rim_Paint']) expect(names.has(hidden)).toBe(false);
  });

  it('boya bölgelerinin her biri gövdeden üçgen alır (yüzey adalarıyla temiz sınır)', async () => {
    const prepared = await prepare();
    const tris = new Map<string, number>();
    prepared.root.traverse((o) => {
      if (!('isMesh' in o) || !o.isMesh) return;
      const mesh = o as Mesh;
      const mats = [mesh.material].flat();
      const groups = mesh.geometry.groups.length
        ? mesh.geometry.groups
        : [{ start: 0, count: mesh.geometry.index?.count ?? 0, materialIndex: 0 }];
      for (const g of groups) {
        const name = mats[g.materialIndex ?? 0]?.name ?? '?';
        tris.set(name, (tris.get(name) ?? 0) + g.count / 3);
      }
    });
    for (const zone of car.manifest.paintZones)
      expect(tris.get(`paint_${zone}`) ?? 0, zone).toBeGreaterThan(300);
    expect(tris.has('CarPaint')).toBe(false);
  });

  it('tekerlek konumları lastik adalarıyla uyumlu; stok kurulumda yedek parça gerekmez', async () => {
    const { wheels, dimensions } = car.manifest;
    expect(wheels.FL.position[2] - wheels.RL.position[2]).toBeCloseTo(dimensions.wheelbase, 2);
    const prepared = await prepare();
    expect(
      slotsNeedingPlaceholder(prepared.analysis, car.manifest, defaultParts(car.manifest)),
    ).toEqual([]);
  });

  it('statik birleştirme çizim sayısını düşürür', async () => {
    const prepared = await prepare();
    const { before, after } = mergeStaticMeshes(prepared.root);
    expect(after).toBeLessThan(before);
  });

  it('yüzey haritası modelle güncel (örnek noktalarda doğrudan ışın izleme, ±1 cm)', async () => {
    const root = (await prepare()).root;
    root.updateMatrixWorld(true);
    const rc = new Raycaster();
    for (const [z, x] of [
      [1.5, 0],
      [-0.3, 0],
      [-2.0, 0.3],
    ] as const) {
      rc.set(new Vector3(x, 5, z), new Vector3(0, -1, 0));
      const hit = rc.intersectObject(root, true)[0]?.point.y ?? 0;
      expect(Math.abs(hit - (sample2(car.surface!.top, z, x) ?? 0))).toBeLessThan(0.01);
    }
  });
});
