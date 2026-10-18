import type { Material, Object3D } from 'three';
import type { CarManifest } from '../manifest/types';
import { applyModelMap, type ModelMap } from './modelMap';
import {
  analyzeModel,
  bindSharedMaterials,
  type MaterialBinding,
  type ModelAnalysis,
  type ModelWarning,
} from './modelRules';

export type PreparedModel = {
  /** Sahneye eklenecek kök (yüklenen modelin klonu) */
  root: Object3D;
  analysis: ModelAnalysis;
  binding: MaterialBinding;
  /** Analiz + materyal uyarıları */
  warnings: ModelWarning[];
};

/** Mesh'lerde gölge ayarı; model dosyaları bunu taşımaz. */
function enableShadows(root: Object3D): void {
  root.traverse((object) => {
    if ('isMesh' in object && object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
}

/**
 * Yüklenmiş modeli oyuna hazırlar: klonlar, isimlendirme kurallarına göre çözümler ve adlı
 * materyalleri paylaşılan araç materyalleriyle (boya, krom, cam...) değiştirir.
 * Orijinal (önbellekteki) sahneye dokunmaz.
 */
export function prepareModel(
  scene: Object3D,
  manifest: CarManifest,
  shared: ReadonlyMap<string, Material>,
  map?: ModelMap,
): PreparedModel {
  const cloned = scene.clone(true);
  // Kurallara uymayan model: önce eşleme (dönüşüm, gizleme, boya bölgeleri, adlandırma)
  const root = map ? applyModelMap(cloned, map) : cloned;
  const analysis = analyzeModel(root, manifest);
  const binding = bindSharedMaterials(root, shared);
  enableShadows(root);

  // Eşlemeli modellerde tekerlek çapası zaten yoktur (manifest konumları esas): gürültü yapma
  const warnings = analysis.warnings.filter((w) => !(map && w.code === 'anchor_missing'));
  for (const name of binding.unknown) {
    if (name.startsWith('paint_'))
      warnings.push({
        code: 'unknown_paint_zone',
        message: `"${name}" materyali: manifestte "${name.slice(6)}" boya bölgesi yok, modelin kendi materyali kullanılacak`,
      });
    else if (name.startsWith('mat_'))
      warnings.push({
        code: 'unknown_material',
        message: `"${name}" tanınmayan bir paylaşılan materyal adı, modelin kendi materyali kullanılacak`,
      });
  }
  return { root, analysis, binding, warnings };
}

/** Konsola tek bir özet olarak yazılacak metin (uyarı yoksa null). Slot başına eksik seçenekler tek satırda. */
export function formatWarnings(url: string, warnings: ModelWarning[]): string | null {
  if (warnings.length === 0) return null;
  const missing = new Map<string, string[]>();
  const lines: string[] = [];
  for (const w of warnings) {
    if (w.code === 'missing_option' && w.slot && w.option) {
      const list = missing.get(w.slot) ?? [];
      list.push(w.option);
      missing.set(w.slot, list);
    } else lines.push(` - [${w.code}] ${w.message}`);
  }
  for (const [slot, options] of missing)
    lines.push(` - [missing_option] ${slot}: modelde yok -> placeholder (${options.join(', ')})`);
  return `[Model] ${url}: ${warnings.length} uyarı\n${lines.join('\n')}`;
}
