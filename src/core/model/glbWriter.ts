/**
 * Minimal GLB (glTF 2.0 ikili) yazıcı: yalnızca test ve örnek model üretimi içindir.
 * Düğüm adları ve materyal adları kurallara (docs/ASSET_GUIDE.md) uygun modeller kurmaya yeter;
 * doku, animasyon ve sıkıştırma yoktur. Uygulama kodu bunu içe aktarmaz.
 */

export type GlbMeshData = {
  /** x,y,z üçlüleri */
  positions: number[];
  /** x,y,z üçlüleri (birim); verilmezse yüzeyler düz gölgelenir */
  normals?: number[];
  indices: number[];
};

export type GlbMaterial = {
  name: string;
  color: [number, number, number, number?];
  metallic?: number;
  roughness?: number;
};

export type GlbNode = {
  name: string;
  translation?: [number, number, number];
  /** Verilirse bu düğüm bir mesh taşır */
  mesh?: GlbMeshData & { material: string };
  children?: GlbNode[];
};

/** Eksen hizalı kutu: 24 köşe (yüz başına 4, düz normal). */
export function boxMesh(
  size: [number, number, number],
  center: [number, number, number] = [0, 0, 0],
): GlbMeshData {
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const faces: { n: [number, number, number]; corners: [number, number, number][] }[] = [
    {
      n: [1, 0, 0],
      corners: [
        [hx, -hy, -hz],
        [hx, hy, -hz],
        [hx, hy, hz],
        [hx, -hy, hz],
      ],
    },
    {
      n: [-1, 0, 0],
      corners: [
        [-hx, -hy, hz],
        [-hx, hy, hz],
        [-hx, hy, -hz],
        [-hx, -hy, -hz],
      ],
    },
    {
      n: [0, 1, 0],
      corners: [
        [-hx, hy, -hz],
        [-hx, hy, hz],
        [hx, hy, hz],
        [hx, hy, -hz],
      ],
    },
    {
      n: [0, -1, 0],
      corners: [
        [-hx, -hy, hz],
        [-hx, -hy, -hz],
        [hx, -hy, -hz],
        [hx, -hy, hz],
      ],
    },
    {
      n: [0, 0, 1],
      corners: [
        [-hx, -hy, hz],
        [hx, -hy, hz],
        [hx, hy, hz],
        [-hx, hy, hz],
      ],
    },
    {
      n: [0, 0, -1],
      corners: [
        [hx, -hy, -hz],
        [-hx, -hy, -hz],
        [-hx, hy, -hz],
        [hx, hy, -hz],
      ],
    },
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  faces.forEach((face, i) => {
    for (const c of face.corners)
      positions.push(c[0] + center[0], c[1] + center[1], c[2] + center[2]);
    for (let k = 0; k < 4; k++) normals.push(...face.n);
    const v = i * 4;
    indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
  });
  return { positions, normals, indices };
}

const pad4 = (n: number) => (n + 3) & ~3;

type Json = Record<string, unknown>;

/** Düğüm ağacından GLB bayt dizisi üretir. */
export function buildGlb(roots: GlbNode[], materials: GlbMaterial[]): ArrayBuffer {
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  const bufferViews: Json[] = [];
  const accessors: Json[] = [];
  const meshes: Json[] = [];
  const nodes: Json[] = [];
  const materialIndex = new Map(materials.map((m, i) => [m.name, i]));

  const addView = (data: ArrayBufferView, target: number): number => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const padded = new Uint8Array(pad4(bytes.length));
    padded.set(bytes);
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.length, target });
    chunks.push(padded);
    byteLength += padded.length;
    return bufferViews.length - 1;
  };

  const addMesh = (data: GlbMeshData & { material: string }, name: string): number => {
    const material = materialIndex.get(data.material);
    if (material === undefined) throw new Error(`GLB: "${data.material}" materyali tanımlı değil`);
    const position = new Float32Array(data.positions);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < position.length; i += 3)
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k] as number, position[i + k] as number);
        max[k] = Math.max(max[k] as number, position[i + k] as number);
      }
    const attributes: Record<string, number> = {};
    accessors.push({
      bufferView: addView(position, 34962),
      componentType: 5126,
      count: position.length / 3,
      type: 'VEC3',
      min,
      max,
    });
    attributes.POSITION = accessors.length - 1;
    if (data.normals) {
      accessors.push({
        bufferView: addView(new Float32Array(data.normals), 34962),
        componentType: 5126,
        count: data.normals.length / 3,
        type: 'VEC3',
      });
      attributes.NORMAL = accessors.length - 1;
    }
    accessors.push({
      bufferView: addView(new Uint16Array(data.indices), 34963),
      componentType: 5123,
      count: data.indices.length,
      type: 'SCALAR',
    });
    meshes.push({
      name,
      primitives: [{ attributes, indices: accessors.length - 1, material }],
    });
    return meshes.length - 1;
  };

  const addNode = (node: GlbNode): number => {
    const json: Json = { name: node.name };
    if (node.translation) json.translation = node.translation;
    if (node.mesh) json.mesh = addMesh(node.mesh, node.name);
    const index = nodes.push(json) - 1;
    if (node.children?.length) json.children = node.children.map(addNode);
    return index;
  };
  const rootIndices = roots.map(addNode);

  const gltf: Json = {
    asset: { version: '2.0', generator: 'muscle-garage glbWriter' },
    scene: 0,
    scenes: [{ nodes: rootIndices }],
    nodes,
    meshes,
    materials: materials.map((m) => ({
      name: m.name,
      pbrMetallicRoughness: {
        baseColorFactor: [m.color[0], m.color[1], m.color[2], m.color[3] ?? 1],
        metallicFactor: m.metallic ?? 0,
        roughnessFactor: m.roughness ?? 0.6,
      },
    })),
    accessors,
    bufferViews,
    buffers: [{ byteLength }],
  };
  if (meshes.length === 0) {
    delete gltf.meshes;
    delete gltf.accessors;
    delete gltf.bufferViews;
    delete gltf.buffers;
  }

  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonPadded = new Uint8Array(pad4(jsonBytes.length)).fill(0x20);
  jsonPadded.set(jsonBytes);
  const binLength = meshes.length === 0 ? 0 : byteLength;
  const total = 12 + 8 + jsonPadded.length + (binLength ? 8 + binLength : 0);

  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);
  view.setUint32(0, 0x46546c67, true); // "glTF"
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonPadded.length, true);
  view.setUint32(16, 0x4e4f534a, true); // "JSON"
  bytes.set(jsonPadded, 20);
  if (binLength) {
    let offset = 20 + jsonPadded.length;
    view.setUint32(offset, binLength, true);
    view.setUint32(offset + 4, 0x004e4942, true); // "BIN\0"
    offset += 8;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
  }
  return out;
}
