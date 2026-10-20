import { readFileSync } from 'node:fs';
import { MeshStandardMaterial, type Material, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** Testler ve geliştirme araçları için: Node'da gerçek GLB yükleme (uygulama kodu kullanmaz). */
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
  // Geometri uzantıları (meshopt, nicemleme) kalır; doku uzantıları (webp, ktx2) atılır
  const keep = (list: unknown) =>
    Array.isArray(list)
      ? list.filter((e) => typeof e === 'string' && /meshopt|quantization/i.test(e))
      : [];
  json.extensionsUsed = keep(json.extensionsUsed);
  json.extensionsRequired = keep(json.extensionsRequired);
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

export function loadGlbScene(url: URL): Promise<Object3D> {
  const data = stripTextures(readFileSync(url));
  return MeshoptDecoder.ready.then(
    () =>
      new Promise((resolve, reject) =>
        new GLTFLoader()
          .setMeshoptDecoder(MeshoptDecoder)
          .parse(data, '', (g) => resolve(g.scene), reject),
      ),
  );
}

/** prepareModel'in beklediği paylaşılan materyaller (adları yeterli). */
export const sharedTestMaterials = new Map<string, Material>(
  [
    ...['body', 'hood', 'roof', 'doors', 'trunk', 'bumpers', 'mirrors'].map((z) => `paint_${z}`),
    'mat_glass',
  ].map((n) => [n, new MeshStandardMaterial({ name: n })]),
);
