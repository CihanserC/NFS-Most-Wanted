import {
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Mesh,
  type InterleavedBufferAttribute,
  type Material,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Slot seçeneği düğümü (`slot__seçenek`): görünürlüğü ayrı açılıp kapandığı için birleştirilmez. */
const SLOT_NODE = /^[a-z0-9_]+__[a-z0-9_]+$/;

const isMesh = (o: Object3D): o is Mesh => 'isMesh' in o && o.isMesh === true;

function underSlotNode(object: Object3D, root: Object3D): boolean {
  for (let o: Object3D | null = object; o && o !== root; o = o.parent)
    if (SLOT_NODE.test(o.name) && !o.name.startsWith('body__')) return true;
  return false;
}

/** Nicemlenmiş (meshopt/KHR_mesh_quantization) özniteliği Float32'ye açar: dönüşüm işlenebilsin. */
function toFloat(attr: BufferAttribute | InterleavedBufferAttribute): BufferAttribute {
  const n = attr.count;
  const size = attr.itemSize;
  const out = new Float32Array(n * size);
  for (let i = 0; i < n; i++)
    for (let k = 0; k < size; k++) out[i * size + k] = attr.getComponent(i, k);
  return new BufferAttribute(out, size);
}

/** Mesh parçası: bir materyal ve o materyale düşen üçgenler (araç kökü uzayında). */
type Piece = { geometry: BufferGeometry; material: Material; cast: boolean; receive: boolean };

function piecesOf(mesh: Mesh, toRoot: Matrix4): Piece[] {
  const source = mesh.geometry;
  const geometry = new BufferGeometry();
  for (const [name, attr] of Object.entries(source.attributes))
    geometry.setAttribute(name, toFloat(attr));
  if (source.index) geometry.setIndex(source.index.clone());
  else geometry.setIndex([...Array(source.getAttribute('position').count).keys()]);
  geometry.applyMatrix4(toRoot);
  const materials = [mesh.material].flat();
  // Tek materyalde gruplar anlamsızdır (ör. BoxGeometry'nin 6 yüz grubu): tümü tek parça
  const groups =
    Array.isArray(mesh.material) && source.groups.length
      ? source.groups
      : [{ start: 0, count: geometry.index?.count ?? 0, materialIndex: 0 }];
  const index = geometry.index as BufferAttribute;
  return groups.map((g) => {
    const part = geometry.clone();
    part.setIndex(Array.from(index.array.slice(g.start, g.start + g.count)));
    part.clearGroups();
    return {
      geometry: part,
      material: materials[g.materialIndex ?? 0] as Material,
      cast: mesh.castShadow,
      receive: mesh.receiveShadow,
    };
  });
}

const signature = (g: BufferGeometry) =>
  Object.entries(g.attributes)
    .map(([n, a]) => `${n}:${a.itemSize}`)
    .sort()
    .join(',');

/**
 * Modelin statik gövde mesh'lerini materyale göre birleştirir (çizim çağrısı azaltma). Dönüşümler
 * geometriye işlenir, birleşik mesh'ler köke kimlik dönüşümüyle eklenir; dünya konumları ve
 * materyaller aynen kalır (vinil projeksiyonu dünya uzayında çalıştığı için etkilenmez).
 * Slot seçeneği düğümleri ve iskeletli/morph mesh'ler olduğu gibi bırakılır.
 * Döner: önceki ve sonraki mesh sayısı.
 */
export function mergeStaticMeshes(root: Object3D): { before: number; after: number } {
  root.updateMatrixWorld(true);
  const rootInverse = new Matrix4().copy(root.matrixWorld).invert();
  const candidates: Mesh[] = [];
  let before = 0;
  root.traverse((o) => {
    if (!isMesh(o)) return;
    before++;
    const skinned = 'isSkinnedMesh' in o && o.isSkinnedMesh === true;
    const morph = Object.keys(o.geometry.morphAttributes).length > 0;
    if (o.visible && !skinned && !morph && !underSlotNode(o, root)) candidates.push(o);
  });

  const buckets = new Map<string, Piece[]>();
  for (const mesh of candidates) {
    const toRoot = new Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld);
    for (const piece of piecesOf(mesh, toRoot)) {
      const key = `${piece.material.uuid}|${signature(piece.geometry)}|${piece.cast}|${piece.receive}`;
      const list = buckets.get(key) ?? [];
      list.push(piece);
      buckets.set(key, list);
    }
  }
  for (const mesh of candidates) mesh.parent?.remove(mesh);

  let merged = 0;
  for (const pieces of buckets.values()) {
    const first = pieces[0] as Piece;
    const geometry =
      pieces.length === 1 ? first.geometry : mergeGeometries(pieces.map((p) => p.geometry));
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, first.material);
    mesh.name = `merged__${first.material.name}`;
    mesh.castShadow = first.cast;
    mesh.receiveShadow = first.receive;
    root.add(mesh);
    merged++;
  }
  return { before, after: before - candidates.length + merged };
}
