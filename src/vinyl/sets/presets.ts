import setsJson from '../../data/vinyl/sets.json';
import { newLayerId, sanitizeLayer } from '../../core/vinyl/layers';
import type { VinylLayer } from '../../core/vinyl/types';
import { hasVinylShape, shapeAspect, TEXT_SHAPE_ID } from '../shapes/library';

/** Hazır vinil setleri (data/vinyl/sets.json): orijinal tasarımlar. */
export type VinylSet = { id: string; layers: Omit<VinylLayer, 'id'>[] };

type RawSet = { id: string; layers: Record<string, unknown>[] };

function loadSets(input: unknown): VinylSet[] {
  if (!Array.isArray(input)) throw new Error('sets.json bir dizi olmalı');
  return (input as RawSet[]).map((set, i) => {
    if (typeof set.id !== 'string' || !Array.isArray(set.layers))
      throw new Error(`sets.json[${i}] geçersiz`);
    const layers = set.layers.map((raw, j) => {
      const layer = sanitizeLayer({ ...raw, id: 'preset' }, hasVinylShape);
      if (!layer) throw new Error(`sets.json[${i}].layers[${j}] geçersiz şekil`);
      // Yazı katmanında genişlik 0 ise metnin doğal en-boy oranından hesaplanır.
      if (layer.shapeId === TEXT_SHAPE_ID && !(Number(raw.scale && (raw.scale as number[])[0]) > 0))
        layer.scale = [
          layer.scale[1] * shapeAspect(TEXT_SHAPE_ID, layer.text, layer.fontId),
          layer.scale[1],
        ];
      const { id: _id, ...rest } = layer;
      return rest;
    });
    return { id: set.id, layers };
  });
}

export const VINYL_SETS = loadSets(setsJson);

/**
 * Seti yeni katmanlar olarak üretir. Her yüzeydeki parçalar ayrı bir grup olur ki
 * (grup dönüşümü tek yüzde çalıştığı için) birlikte taşınabilsin.
 */
export function instantiateSet(set: VinylSet): VinylLayer[] {
  const groups = new Map<string, string>();
  return set.layers.map((l) => {
    if (!groups.has(l.side)) groups.set(l.side, newLayerId().replace(/^v/, 'g'));
    return { ...l, id: newLayerId(), groupId: groups.get(l.side) };
  });
}
