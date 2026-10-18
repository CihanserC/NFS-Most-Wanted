import type { Material, Object3D } from 'three';
import { Vector3 } from 'three';
import type { CarManifest, WheelId } from '../manifest/types';
import { WHEEL_IDS } from '../manifest/types';

/** GLB isimlendirme kuralları (docs/ASSET_GUIDE.md ile aynı). */
export const BODY_PREFIX = 'body';
export const ANCHOR_PREFIX = 'wheel_anchor_';
/** Tekerlek çapası konumu manifestten bu kadar sapabilir (m) */
export const ANCHOR_TOLERANCE = 0.03;

export type ParsedName =
  | { kind: 'body'; part: string }
  | { kind: 'option'; slot: string; option: string }
  | { kind: 'anchor'; wheel: WheelId }
  | { kind: 'other' };

/** Blender kopya eki (".001") ve baştaki/sondaki boşlukları atar. */
export const normalizeName = (name: string): string => name.trim().replace(/\.\d{3,}$/, '');

/** "hood__shaker_scoop" -> slot/seçenek; "body__main" -> gövde; "wheel_anchor_FL" -> çapa. */
export function parseObjectName(rawName: string): ParsedName {
  const name = normalizeName(rawName);
  if (name.startsWith(ANCHOR_PREFIX)) {
    const wheel = name.slice(ANCHOR_PREFIX.length);
    return (WHEEL_IDS as readonly string[]).includes(wheel)
      ? { kind: 'anchor', wheel: wheel as WheelId }
      : { kind: 'other' };
  }
  const split = name.indexOf('__');
  if (split <= 0) return { kind: 'other' };
  const slot = name.slice(0, split);
  const option = name.slice(split + 2);
  if (!/^[a-z0-9_]+$/.test(slot) || !/^[a-z0-9_]+$/.test(option)) return { kind: 'other' };
  return slot === BODY_PREFIX ? { kind: 'body', part: option } : { kind: 'option', slot, option };
}

/** Bazı slotlar yalnızca belirli koşulda görünür (placeholder çizimiyle aynı kural). */
const VISIBILITY_RULES: Record<string, (parts: Record<string, string>) => boolean> = {
  // Motor sadece kaput kesikken görünür; aksi halde kapalı kaputun altında kalır.
  engine: (parts) => parts.hood === 'blower_cutout',
};

export const isSlotVisible = (slot: string, parts: Record<string, string>): boolean =>
  VISIBILITY_RULES[slot]?.(parts) ?? true;

export type ModelWarningCode =
  | 'no_body'
  | 'missing_option'
  | 'unknown_slot'
  | 'unknown_option'
  | 'anchor_missing'
  | 'anchor_mismatch'
  | 'unknown_material'
  | 'unknown_paint_zone';

export type ModelWarning = {
  code: ModelWarningCode;
  message: string;
  slot?: string;
  option?: string;
};

export type ModelAnalysis = {
  /** Gövde (body__*) bulundu: model kullanılabilir */
  usable: boolean;
  bodyObjects: Object3D[];
  /** slot -> seçenek -> modeldeki nesneler (yalnızca manifestte tanımlı olanlar) */
  options: Record<string, Record<string, Object3D[]>>;
  anchors: Partial<Record<WheelId, Vector3>>;
  /** Manifestte olmayan "slot__seçenek" adları */
  unknown: string[];
  warnings: ModelWarning[];
};

/** Seçenek geometri gerektirmez mi ("none" ya da manifestteki modelEmptyOptions). */
export function isEmptyOption(manifest: CarManifest, slot: string, option: string): boolean {
  return option === 'none' || (manifest.modelEmptyOptions?.[slot]?.includes(option) ?? false);
}

/**
 * Model ağacını isimlendirme kurallarına göre çözümler. Hiçbir şey fırlatmaz: sorunlar
 * `warnings` içinde toplanır; gövde yoksa `usable` false olur (placeholder'a düşülür).
 * Adlandırılmış bir nesne bulunduğunda altına inilmez (çocuklar onunla birlikte görünür/gizlenir).
 */
export function analyzeModel(root: Object3D, manifest: CarManifest): ModelAnalysis {
  const analysis: ModelAnalysis = {
    usable: false,
    bodyObjects: [],
    options: {},
    anchors: {},
    unknown: [],
    warnings: [],
  };
  const warn = (w: ModelWarning) => analysis.warnings.push(w);
  // Çapa konumları dünya uzayında okunur: matrisler güncel olmalı
  root.updateWorldMatrix(true, true);

  const visit = (object: Object3D) => {
    const parsed = parseObjectName(object.name);
    if (parsed.kind === 'body') {
      analysis.bodyObjects.push(object);
      return;
    }
    if (parsed.kind === 'anchor') {
      analysis.anchors[parsed.wheel] = object.getWorldPosition(new Vector3());
      return;
    }
    if (parsed.kind === 'option') {
      const slot = manifest.slots[parsed.slot];
      if (!slot) {
        analysis.unknown.push(normalizeName(object.name));
        warn({
          code: 'unknown_slot',
          message: `"${object.name}": manifestte "${parsed.slot}" slotu yok, yok sayıldı`,
          slot: parsed.slot,
        });
        return;
      }
      if (!slot.options.includes(parsed.option)) {
        analysis.unknown.push(normalizeName(object.name));
        warn({
          code: 'unknown_option',
          message: `"${object.name}": "${parsed.slot}" slotunda "${parsed.option}" seçeneği yok, yok sayıldı`,
          slot: parsed.slot,
          option: parsed.option,
        });
        return;
      }
      ((analysis.options[parsed.slot] ??= {})[parsed.option] ??= []).push(object);
      return;
    }
    for (const child of object.children) visit(child);
  };
  for (const child of root.children) visit(child);
  // Kök adı da kurallara uyabilir (tek nesneli model)
  if (root.children.length === 0) visit(root);

  analysis.usable = analysis.bodyObjects.length > 0;
  if (!analysis.usable)
    warn({
      code: 'no_body',
      message: 'Modelde "body__main" gövde nesnesi yok: placeholder kullanılacak',
    });

  // Manifestteki seçeneklerden modelde olmayanlar (geometri gerektirmeyenler hariç)
  for (const [slotId, slot] of Object.entries(manifest.slots))
    for (const option of slot.options)
      if (!analysis.options[slotId]?.[option] && !isEmptyOption(manifest, slotId, option))
        warn({
          code: 'missing_option',
          message: `"${slotId}__${option}" modelde yok: bu seçenek için placeholder çizilecek`,
          slot: slotId,
          option,
        });

  // Tekerlek çapaları: manifestle tutarlılık
  for (const id of WHEEL_IDS) {
    const anchor = analysis.anchors[id];
    if (!anchor) {
      warn({
        code: 'anchor_missing',
        message: `"${ANCHOR_PREFIX}${id}" çapası yok: manifest konumu kullanılacak`,
      });
      continue;
    }
    const [x, y, z] = manifest.wheels[id].position;
    const distance = Math.hypot(anchor.x - x, anchor.y - y, anchor.z - z);
    if (distance > ANCHOR_TOLERANCE)
      warn({
        code: 'anchor_mismatch',
        message: `"${ANCHOR_PREFIX}${id}" manifestten ${(distance * 100).toFixed(1)} cm uzakta (manifest kullanılır)`,
      });
  }
  return analysis;
}

/** Şu anki parçalara göre model nesnelerinin görünürlüğünü ayarlar. */
export function applyModelState(analysis: ModelAnalysis, parts: Record<string, string>): void {
  for (const object of analysis.bodyObjects) object.visible = true;
  for (const [slot, byOption] of Object.entries(analysis.options)) {
    const visibleSlot = isSlotVisible(slot, parts);
    for (const [option, objects] of Object.entries(byOption))
      for (const object of objects) object.visible = visibleSlot && parts[slot] === option;
  }
}

/** Şu anki seçenek için modelde nesne bulunmayan (placeholder çizilmesi gereken) slotlar. */
export function slotsNeedingPlaceholder(
  analysis: ModelAnalysis,
  manifest: CarManifest,
  parts: Record<string, string>,
): string[] {
  const result: string[] = [];
  for (const slotId of Object.keys(manifest.slots)) {
    const option = parts[slotId];
    if (option === undefined || isEmptyOption(manifest, slotId, option)) continue;
    if (!isSlotVisible(slotId, parts)) continue;
    if (!analysis.options[slotId]?.[option]) result.push(slotId);
  }
  return result;
}

export type MaterialBinding = { replaced: string[]; unknown: string[] };

/**
 * Model içindeki adlı materyalleri paylaşılan araç materyalleriyle değiştirir
 * (paint_<bölge>, mat_chrome, mat_glass, ...). Tanınmayanlar olduğu gibi kalır.
 */
export function bindSharedMaterials(
  root: Object3D,
  shared: ReadonlyMap<string, Material>,
): MaterialBinding {
  const replaced = new Set<string>();
  const unknown = new Set<string>();
  root.traverse((object) => {
    const mesh = object as Object3D & { material?: Material | Material[] };
    if (!mesh.material) return;
    const swap = (material: Material): Material => {
      const name = normalizeName(material.name);
      const target = shared.get(name);
      if (target) {
        replaced.add(name);
        return target;
      }
      if (name) unknown.add(name);
      return material;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
  return { replaced: [...replaced], unknown: [...unknown] };
}
