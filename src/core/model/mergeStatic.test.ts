import { describe, expect, it } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { mergeStaticMeshes } from './mergeStatic';

describe('statik mesh birleştirme', () => {
  it('aynı materyalli kutular tek mesh olur; konumlar korunur; tek materyalde yüz grupları sorun olmaz', () => {
    const a = new MeshStandardMaterial();
    const b = new MeshStandardMaterial();
    const root = new Group();
    const parent = new Group();
    parent.position.set(1, 0, 0);
    parent.scale.setScalar(2);
    root.add(parent);
    for (const [x, m] of [
      [0, a],
      [3, a],
      [6, b],
    ] as const) {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), m);
      mesh.position.x = x;
      parent.add(mesh);
    }
    root.updateMatrixWorld(true);
    const before = new Box3().setFromObject(root);
    const { before: n0, after: n1 } = mergeStaticMeshes(root);
    root.updateMatrixWorld(true);
    expect(n0).toBe(3);
    expect(n1).toBe(2);
    const after = new Box3().setFromObject(root);
    expect(after.min.toArray()).toEqual(before.min.toArray());
    expect(after.max.toArray()).toEqual(before.max.toArray());
  });

  it('slot seçeneği düğümleri birleştirilmez (görünürlükleri ayrı açılıp kapanır)', () => {
    const root = new Group();
    const slot = new Group();
    slot.name = 'spoiler_rear__ducktail';
    const m = new MeshStandardMaterial();
    slot.add(new Mesh(new BoxGeometry(), m));
    root.add(slot, new Mesh(new BoxGeometry(), m), new Mesh(new BoxGeometry(), m));
    const { after } = mergeStaticMeshes(root);
    expect(after).toBe(2);
    expect(slot.children).toHaveLength(1);
  });
});
