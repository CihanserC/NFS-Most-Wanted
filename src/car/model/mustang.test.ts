import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  Box3,
  MeshStandardMaterial,
  Vector3,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { defaultParts } from '../../core/build/build';
import { slotsNeedingPlaceholder } from '../../core/model/modelRules';
import { prepareModel } from '../../core/model/prepareModel';
import { getCar } from '../../data/cars';
import { axleBodies } from '../fitmentBody';

const car = getCar('ford_mustang_gt_2013');
const GLB = new URL('../../../public/assets/cars/ford_mustang_gt_2013.glb', import.meta.url);

/**
 * GLB'den doku/uzantı referanslarını çıkarır (Node'da görüntü çözümü yok); geometri ve adlar kalır.
 * Gerçek modelin düğüm/materyal adlarını ve ölçülerini sınamak için yeterli.
 */
function stripTextures(buffer: Buffer): ArrayBuffer {
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8')) as {
    images?: unknown;
    textures?: unknown;
    samplers?: unknown;
    extensionsUsed?: unknown;
    extensionsRequired?: unknown;
    materials: Record<string, unknown>[];
  };
  delete json.images;
  delete json.textures;
  delete json.samplers;
  delete json.extensionsUsed;
  delete json.extensionsRequired;
  json.materials = json.materials.map((m) => ({
    name: m.name,
    pbrMetallicRoughness: { baseColorFactor: [0.5, 0.5, 0.5, 1] },
  }));
  const bytes = Buffer.from(JSON.stringify(json), 'utf8');
  const padded = Buffer.alloc((bytes.length + 3) & ~3, 0x20);
  bytes.copy(padded);
  const rest = buffer.subarray(20 + jsonLength);
  const out = Buffer.alloc(20 + padded.length + rest.length);
  buffer.copy(out, 0, 0, 12);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(padded.length, 12);
  buffer.copy(out, 16, 16, 20);
  padded.copy(out, 20);
  rest.copy(out, 20 + padded.length);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
}

function loadScene(): Promise<Object3D> {
  const data = stripTextures(readFileSync(GLB));
  return new Promise((resolve, reject) =>
    new GLTFLoader().parse(data, '', (g) => resolve(g.scene), reject),
  );
}

const shared = new Map<string, Material>(
  ['paint_body', 'paint_hood', 'mat_glass'].map((n) => [n, new MeshStandardMaterial({ name: n })]),
);

describe('2013 Ford Mustang GT (gerçek GLB)', () => {
  it('manifest araç kayıt defterinde ve model yolu public altında', () => {
    expect(car.manifest.model).toBe('assets/cars/ford_mustang_gt_2013.glb');
    expect(car.modelMap).toBeDefined();
    expect(car.manifest.paintZones).toEqual(['body', 'hood']);
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

  it('boya bölgeleri: kaput hood, kalan tüm kaporta body (ön/arka kit tek parça); cam paylaşılan cam', async () => {
    const prepared = prepareModel(await loadScene(), car.manifest, shared, car.modelMap);
    const zoneOf = (needle: string) => {
      const zones = new Set<string>();
      prepared.root.traverse((o) => {
        if (!('isMesh' in o) || !o.isMesh || !o.name.includes(needle)) return;
        for (const m of [(o as Mesh).material].flat()) zones.add(m.name);
      });
      return zones;
    };
    expect(zoneOf('SM_Hood').has('paint_hood')).toBe(true);
    expect(zoneOf('SM_FrontKit').has('paint_body')).toBe(true);
    expect(zoneOf('SM_RearKit').has('paint_body')).toBe(true);
    expect(zoneOf('D_Body').has('paint_body')).toBe(true);
    expect(prepared.binding.replaced.sort()).toEqual(
      expect.arrayContaining(['mat_glass', 'paint_body', 'paint_hood']),
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
