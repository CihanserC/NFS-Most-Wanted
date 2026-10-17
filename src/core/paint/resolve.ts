import paintTypesJson from '../../data/paints/types.json';
import { PAINT_TYPES, type PaintConfig, type PaintType } from './types';

/**
 * Boya tipinin malzeme davranışı (data/paints/types.json). Aralıklar [gloss=0, gloss=1]
 * değerlerini verir; gloss ile doğrusal olarak karıştırılır.
 */
export type PaintTypeProfile = {
  metalness: number;
  roughness: [number, number];
  clearcoat: number;
  clearcoatRoughness: [number, number];
  flakeStrength: number;
  flakeTint: number;
  fresnel: number;
  sheen: number;
  iridescence: number;
  iridescenceIOR: number;
  iridescenceThicknessRange: [number, number];
};

/** Pul boyutu -> metre başına hücre sayısı [ince, iri]. */
export const FLAKE_CELLS_PER_METER: [number, number] = [700, 180];

export const paintTypeProfiles = paintTypesJson as Record<PaintType, PaintTypeProfile>;

/** Shader'daki uPaintMode değeri; PAINT_TYPES sırası. */
export const paintMode = (type: PaintType) => PAINT_TYPES.indexOf(type);

/** Bir PaintConfig'in materyale uygulanacak son parametreleri (three'den bağımsız). */
export type ResolvedPaint = {
  mode: number;
  color: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen: number;
  sheenColor: string;
  iridescence: number;
  iridescenceIOR: number;
  iridescenceThicknessRange: [number, number];
  flakeScale: number;
  flakeDensity: number;
  flakeStrength: number;
  flakeTint: number;
  flakeColor: string;
  color2: string;
  color3: string;
  fresnel: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const range = (r: [number, number], t: number) => lerp(r[0], r[1], t);

export function resolvePaint(p: PaintConfig): ResolvedPaint {
  const prof = paintTypeProfiles[p.type];
  const hasFlakes = prof.flakeStrength > 0;
  return {
    mode: paintMode(p.type),
    color: p.color,
    metalness: prof.metalness,
    roughness: range(prof.roughness, p.gloss),
    clearcoat: prof.clearcoat,
    clearcoatRoughness: range(prof.clearcoatRoughness, p.gloss),
    sheen: prof.sheen,
    sheenColor: p.secondaryColor,
    iridescence: prof.iridescence,
    iridescenceIOR: prof.iridescenceIOR,
    iridescenceThicknessRange: prof.iridescenceThicknessRange,
    flakeScale: range(FLAKE_CELLS_PER_METER, p.flakeSize),
    flakeDensity: hasFlakes ? p.flakeDensity : 0,
    flakeStrength: prof.flakeStrength,
    flakeTint: prof.flakeTint,
    flakeColor: p.flakeColor,
    color2: p.secondaryColor,
    color3: p.tertiaryColor,
    fresnel: prof.fresnel,
  };
}
