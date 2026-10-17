import type { LayerInstance } from './projection';

/**
 * Maske / kesme katmanlarının çizim planı (saf). Bir 'mask' veya 'cutout' katmanı kendisi
 * çizilmez; altındaki en yakın normal katmanı kırpar:
 * - mask: hedef sadece maske şeklinin içinde kalır (kesişim)
 * - cutout: maske şeklinin içi hedeften silinir
 * Art arda birden fazla değiştirici aynı hedefe sırayla uygulanır. Altında hedef
 * olmayan değiştirici yok sayılır.
 */
export type DrawOp = { target: LayerInstance; modifiers: LayerInstance[] };

export const isModifier = (inst: LayerInstance) => inst.layer.maskMode !== 'none';

export function composeOps(instances: LayerInstance[]): DrawOp[] {
  const ops: DrawOp[] = [];
  for (const inst of instances) {
    if (isModifier(inst)) {
      const last = ops[ops.length - 1];
      if (last) last.modifiers.push(inst);
      continue;
    }
    ops.push({ target: inst, modifiers: [] });
  }
  return ops;
}
