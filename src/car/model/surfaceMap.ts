import { Box3, Raycaster, Vector3, type Object3D } from 'three';
import type { CarSurface, Grid1, Grid2 } from '../surface';

/** Örnekleme adımı (m) */
const STEP = 0.05;
const round = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Hazırlanmış (araç uzayına oturtulmuş) modeli ışın izleyerek gövde yüzey haritası çıkarır.
 * Yalnız görünür mesh'ler sayılır (gizlenen tekerlek/fren/alt plaka hariç). Geliştirme aracıdır:
 * `surface.gen.test.ts` ile çalıştırılıp çıktı `src/data/cars/<id>/surface.json`'a yazılır.
 */
export function sampleSurface(root: Object3D): CarSurface {
  root.updateMatrixWorld(true);
  const meshes: Object3D[] = [];
  root.traverse((o) => {
    if ('isMesh' in o && o.isMesh && o.visible) meshes.push(o);
  });
  const rc = new Raycaster();
  const origin = new Vector3();
  const dir = new Vector3();
  const cast = (o: [number, number, number], d: [number, number, number]) => {
    rc.set(origin.set(...o), dir.set(...d).normalize());
    return rc.intersectObjects(meshes, false)[0]?.point ?? null;
  };
  const box = new Box3().setFromObject(root);
  const span = (lo: number, hi: number) => {
    const start = Math.floor(lo / STEP) * STEP;
    const n = Math.ceil((hi - start) / STEP) + 1;
    return { start: round(start), n };
  };
  const zs = span(box.min.z, box.max.z);
  const xs = span(0, box.max.x);
  const ys = span(Math.max(0, box.min.y), box.max.y);
  const above = box.max.y + 1;
  const below = box.min.y - 1;
  const outside = box.max.x + 1;

  const zAt = (i: number) => zs.start + i * STEP;
  const top: Grid2 = { z0: zs.start, dz: STEP, c0: 0, dc: STEP, values: [] };
  const side: Grid2 = { z0: zs.start, dz: STEP, c0: ys.start, dc: STEP, values: [] };
  for (let i = 0; i < zs.n; i++) {
    const z = zAt(i);
    const topRow: (number | null)[] = [];
    for (let k = 0; k < xs.n; k++) {
      const p = cast([k * STEP, above, z], [0, -1, 0]);
      topRow.push(p ? round(p.y) : null);
    }
    top.values.push(topRow);
    const sideRow: (number | null)[] = [];
    for (let k = 0; k < ys.n; k++) {
      const p = cast([outside, ys.start + k * STEP, z], [-1, 0, 0]);
      sideRow.push(p ? round(p.x) : null);
    }
    side.values.push(sideRow);
  }
  const bottom: Grid1 = { start: zs.start, step: STEP, values: [] };
  for (let i = 0; i < zs.n; i++) {
    const p = cast([0, below, zAt(i)], [0, 1, 0]);
    bottom.values.push(p ? round(p.y) : null);
  }
  const nose: Grid1 = { start: ys.start, step: STEP, values: [] };
  const tail: Grid1 = { start: ys.start, step: STEP, values: [] };
  for (let k = 0; k < ys.n; k++) {
    const y = ys.start + k * STEP;
    const f = cast([0, y, box.max.z + 1], [0, 0, -1]);
    const r = cast([0, y, box.min.z - 1], [0, 0, 1]);
    nose.values.push(f ? round(f.z) : null);
    tail.values.push(r ? round(r.z) : null);
  }
  return { top, side, bottom, nose, tail };
}
