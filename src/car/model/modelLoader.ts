import type { WebGLRenderer } from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** Çözücüler `npm run assets:decoders` ile public/assets/decoders'a kopyalanır (CDN gerekmez). */
const DECODERS = `${import.meta.env.BASE_URL}assets/decoders/`;

let loader: GLTFLoader | null = null;
const cache = new Map<string, Promise<GLTF>>();

/** Draco (geometri), KTX2/Basis (doku) ve Meshopt destekli GLTFLoader (tek örnek). */
function getLoader(gl: WebGLRenderer): GLTFLoader {
  if (loader) return loader;
  const draco = new DRACOLoader().setDecoderPath(`${DECODERS}draco/`);
  const ktx2 = new KTX2Loader().setTranscoderPath(`${DECODERS}basis/`).detectSupport(gl);
  loader = new GLTFLoader()
    .setDRACOLoader(draco)
    .setKTX2Loader(ktx2)
    .setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

/** GLB'yi yükler; aynı URL tekrar istenirse önbellekten döner. Hata olursa önbellek temizlenir. */
export function loadCarModel(url: string, gl: WebGLRenderer): Promise<GLTF> {
  let pending = cache.get(url);
  if (!pending) {
    pending = getLoader(gl).loadAsync(url);
    cache.set(url, pending);
    pending.catch(() => cache.delete(url));
  }
  return pending;
}
