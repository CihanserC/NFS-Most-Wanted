import { normalizeHex } from '../../core/color/color';
import { validatePaint } from '../../core/paint/paint';
import type { PaintConfig } from '../../core/paint/types';
import paletteJson from './palette.json';
import presetsJson from './presets.json';

export type PaletteColor = { id: string; hex: string };
export type PaintPreset = { id: string; paint: PaintConfig };

function loadPalette(input: unknown): PaletteColor[] {
  if (!Array.isArray(input)) throw new Error('palette.json bir dizi olmalı');
  return input.map((c: { id?: unknown; hex?: unknown }, i) => {
    const hex = typeof c.hex === 'string' ? normalizeHex(c.hex) : null;
    if (typeof c.id !== 'string' || !hex) throw new Error(`palette.json[${i}] geçersiz`);
    return { id: c.id, hex };
  });
}

function loadPresets(input: unknown): PaintPreset[] {
  if (!Array.isArray(input)) throw new Error('presets.json bir dizi olmalı');
  return input.map((p: { id?: unknown; paint?: unknown }, i) => {
    const errors = validatePaint(p.paint);
    if (typeof p.id !== 'string' || errors.length > 0)
      throw new Error(`presets.json[${i}] geçersiz: ${errors.join('; ')}`);
    return { id: p.id, paint: p.paint as PaintConfig };
  });
}

/** Dönem ruhuna uygun, kurgusal isimli renk paleti. */
export const paintPalette = loadPalette(paletteJson);
/** Fabrika boya presetleri (tip + tüm parametreler). */
export const paintPresets = loadPresets(presetsJson);
