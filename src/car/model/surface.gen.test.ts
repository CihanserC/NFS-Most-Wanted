import { writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { prepareModel } from '../../core/model/prepareModel';
import { getCar } from '../../data/cars';
import { loadGlbScene, sharedTestMaterials } from './glbTestUtils';
import { sampleSurface } from './surfaceMap';

/**
 * Geliştirme aracı: gerçek modelli araçların yüzey haritasını (`surface.json`) yeniden üretir.
 * Model ya da modelMap değişince çalıştırın:
 *   GEN_SURFACE=1 node node_modules/vitest/vitest.mjs run src/car/model/surface.gen.test.ts
 */
const CARS = ['ford_mustang_gt_2013'];

describe.runIf(process.env.GEN_SURFACE)('yüzey haritası üretimi', () => {
  it.each(CARS)(
    '%s',
    async (id) => {
      const car = getCar(id);
      if (!car.manifest.model) throw new Error(`${id}: model yok`);
      const glb = new URL(`../../../public/${car.manifest.model}`, import.meta.url);
      const prepared = prepareModel(
        await loadGlbScene(glb),
        car.manifest,
        sharedTestMaterials,
        car.modelMap,
      );
      const surface = sampleSurface(prepared.root);
      const out = new URL(`../../data/cars/${id}/surface.json`, import.meta.url);
      writeFileSync(out, JSON.stringify(surface) + '\n');
    },
    300000,
  );
});
