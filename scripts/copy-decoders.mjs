// Draco ve KTX2 (Basis) çözücülerini three'nin paketinden public/assets/decoders altına kopyalar.
// GLTFLoader bunları ağ (CDN) olmadan, kendi sunucumuzdan yükler. three sürümü değişince çalıştır:
//   npm run assets:decoders
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libs = join(root, 'node_modules', 'three', 'examples', 'jsm', 'libs');
const out = join(root, 'public', 'assets', 'decoders');

const copies = [
  ['draco/gltf', 'draco', ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']],
  ['basis', 'basis', ['basis_transcoder.js', 'basis_transcoder.wasm']],
];

for (const [from, to, files] of copies) {
  mkdirSync(join(out, to), { recursive: true });
  for (const file of files) cpSync(join(libs, from, file), join(out, to, file));
}

const version = JSON.parse(readFileSync(join(root, 'node_modules', 'three', 'package.json'), 'utf8')).version;
console.log(`Çözücüler kopyalandı (three ${version}) -> public/assets/decoders`);
