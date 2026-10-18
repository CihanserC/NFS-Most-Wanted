// Kurallara (docs/ASSET_GUIDE.md) uyan, kutulardan oluşan örnek bir araç GLB'si üretir.
// Amaç gerçek model değil, GLB hattını (isimlendirme, paylaşılan materyaller, kısmi model ->
// placeholder yedeği) göstermek ve elle denemektir:
//   npm run assets:demo-model
//   sonra geliştirmede  http://localhost:5173/?model=assets/cars/demo_conforming.glb
// Node 22.6+ TypeScript türlerini kendisi soyar; ayrı bir derleme gerekmez.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boxMesh, buildGlb } from '../src/core/model/glbWriter.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(join(root, 'src/data/cars/vanta_stallion_70/manifest.json'), 'utf8'),
);

const materials = [
  { name: 'paint_body', color: [0.7, 0.1, 0.08], metallic: 0.2, roughness: 0.3 },
  { name: 'paint_hood', color: [0.7, 0.1, 0.08], metallic: 0.2, roughness: 0.3 },
  { name: 'paint_roof', color: [0.7, 0.1, 0.08], metallic: 0.2, roughness: 0.3 },
  { name: 'mat_glass', color: [0.05, 0.08, 0.1, 0.5] },
  { name: 'mat_chrome', color: [0.9, 0.9, 0.9], metallic: 1, roughness: 0.05 },
  { name: 'mat_black_trim', color: [0.05, 0.05, 0.06] },
];

const mesh = (material, size, center) => ({ ...boxMesh(size, center), material });

const wheelAnchors = ['FL', 'FR', 'RL', 'RR'].map((id) => ({
  name: `wheel_anchor_${id}`,
  translation: manifest.wheels[id].position,
}));

const nodes = [
  {
    name: 'body__main',
    mesh: mesh('paint_body', [1.84, 0.5, 4.6], [0, 0.62, 0]),
    children: [
      { name: 'body__cabin', mesh: mesh('mat_glass', [1.5, 0.45, 1.9], [0, 1.1, -0.5]) },
      { name: 'body__roof', mesh: mesh('paint_roof', [1.46, 0.05, 1.6], [0, 1.34, -0.55]) },
    ],
  },
  { name: 'hood__stock', mesh: mesh('paint_hood', [1.5, 0.06, 1.6], [0, 0.9, 1.55]) },
  {
    name: 'hood__cowl_induction',
    mesh: mesh('paint_hood', [1.5, 0.12, 1.6], [0, 0.93, 1.55]),
  },
  {
    name: 'hood__shaker_scoop',
    mesh: mesh('mat_black_trim', [0.55, 0.22, 0.6], [0, 1.0, 1.5]),
  },
  { name: 'grille__stock', mesh: mesh('mat_chrome', [1.2, 0.28, 0.06], [0, 0.62, 2.33]) },
  { name: 'spoiler_rear__ducktail', mesh: mesh('paint_body', [1.5, 0.08, 0.3], [0, 1.0, -2.2]) },
  ...wheelAnchors,
];

const outDir = join(root, 'public/assets/cars');
mkdirSync(outDir, { recursive: true });
const glb = Buffer.from(buildGlb(nodes, materials));
writeFileSync(join(outDir, 'demo_conforming.glb'), glb);
console.log(`demo_conforming.glb yazıldı (${glb.length} bayt)`);
