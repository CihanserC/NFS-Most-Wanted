import { newLayerId } from '../../core/vinyl/layers';
import { applyAffine, layerTransform, type ProjectionSurface } from '../../core/vinyl/projection';
import type { VinylLayer } from '../../core/vinyl/types';
import { glyphShapeId, shapeAspect } from '../shapes/library';
import { layoutText } from '../shapes/strokeFont';

/**
 * "Yazıyı şekle dönüştür": yazı katmanını harf/rakam şekil katmanlarına böler. Harfler
 * aynı yerde, aynı boy/açı/renkte kalır ve tek grup olur; böylece tek tek düzenlenebilir.
 * Kütüphane harfleri Blok stilindedir, bu yüzden diğer fontlar Blok'a dönüşür.
 */
export function textToGlyphLayers(text: VinylLayer, surface: ProjectionSurface): VinylLayer[] {
  const layout = layoutText(text.text ?? '', text.fontId);
  if (!layout) return [];
  const m = layerTransform(text, surface);
  const groupId = newLayerId().replace(/^v/, 'g');
  const height = Math.abs(text.scale[1]) * layout.glyphHeight;
  const out: VinylLayer[] = [];
  for (const g of layout.glyphs) {
    const shapeId = glyphShapeId(g.char);
    if (!shapeId) continue;
    const [mx, my] = applyAffine(m, g.center[0], g.center[1]);
    const { text: _t, fontId: _f, ...base } = text;
    out.push({
      ...base,
      id: newLayerId(),
      shapeId,
      groupId,
      position: [mx / surface.widthM, my / surface.heightM],
      scale: [height * shapeAspect(shapeId), height],
    });
  }
  return out;
}
