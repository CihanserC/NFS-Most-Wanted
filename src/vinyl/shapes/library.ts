import { GLYPHS, layoutText } from './strokeFont';

/**
 * Vinil şekil kütüphanesi (§7.4). Dolgu şekilleri, merkezi orijinde 100×100'lük kutuda
 * (-50..50, y aşağı) SVG path verisidir. Harf/rakamlar orijinal çizgi fontundan
 * (strokeFont.ts) üretilir. Hepsi orijinal çizimdir.
 */
export type VinylShape =
  | {
      id: string;
      kind: 'fill';
      path: string;
      fillRule?: 'nonzero' | 'evenodd';
      /** Doğal en-boy oranı (yerleştirmede scale[0] = scale[1] × aspect) */
      aspect?: number;
      category: ShapeCategory;
    }
  | {
      id: string;
      kind: 'gradient';
      path: string;
      /** Renk soldan (opak) sağa (saydam) solar */
      aspect?: number;
      category: ShapeCategory;
    }
  | {
      /** Tek karakter, çizgi fontuyla (Blok stil) çizilir */
      id: string;
      kind: 'glyph';
      char: string;
      category: ShapeCategory;
    };

export type ShapeCategory = 'basic' | 'stripes' | 'graphics' | 'digits' | 'letters';
export const SHAPE_CATEGORIES: ShapeCategory[] = [
  'basic',
  'stripes',
  'graphics',
  'digits',
  'letters',
];

/** Yazı katmanları için özel şekil kimliği (metin + font katmanda tutulur). */
export const TEXT_SHAPE_ID = 'text';

const polygon = (points: [number, number][]) =>
  `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L')} Z`;

const regular = (sides: number, r: number, rotation = -Math.PI / 2) =>
  polygon(
    Array.from({ length: sides }, (_, i) => {
      const a = rotation + (i / sides) * Math.PI * 2;
      return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
    }),
  );

const star = (points: number, outer: number, inner: number) =>
  polygon(
    Array.from({ length: points * 2 }, (_, i) => {
      const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? outer : inner;
      return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
    }),
  );

const circle = (r: number) => `M${-r},0 A${r},${r} 0 1,0 ${r},0 A${r},${r} 0 1,0 ${-r},0 Z`;

/** Yay biçiminde bant (C şerit): dış yay, iç yay; kutuya sığacak şekilde. */
function arcBand(): string {
  const steps = 32;
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  // Elips merkezi kutunun alt kenarında; üst yarı elips bant kutuyu tam doldurur.
  const cy = 50;
  const outerR: [number, number] = [50, 100];
  const innerR: [number, number] = [40, 82];
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI + (i / steps) * Math.PI;
    outer.push([Math.cos(a) * outerR[0], cy + Math.sin(a) * outerR[1]]);
    inner.push([Math.cos(a) * innerR[0], cy + Math.sin(a) * innerR[1]]);
  }
  return polygon([...outer, ...inner.reverse()]);
}

/** Damalı desen: 4×4 karenin siyah olanları. */
function checker(n: number): string {
  const s = 100 / n;
  const rects: string[] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if ((x + y) % 2 === 0) {
        const x0 = -50 + x * s;
        const y0 = -50 + y * s;
        rects.push(`M${x0},${y0} H${x0 + s} V${y0 + s} H${x0} Z`);
      }
  return rects.join(' ');
}

const FILL_SHAPES: VinylShape[] = [
  { id: 'circle', kind: 'fill', category: 'basic', path: circle(50) },
  {
    id: 'ring',
    kind: 'fill',
    category: 'basic',
    path: `${circle(50)} ${circle(34)}`,
    fillRule: 'evenodd',
  },
  {
    id: 'square',
    kind: 'fill',
    category: 'basic',
    path: polygon([
      [-50, -50],
      [50, -50],
      [50, 50],
      [-50, 50],
    ]),
  },
  {
    id: 'rounded_square',
    kind: 'fill',
    category: 'basic',
    path: 'M-34,-50 H34 A16,16 0 0 1 50,-34 V34 A16,16 0 0 1 34,50 H-34 A16,16 0 0 1 -50,34 V-34 A16,16 0 0 1 -34,-50 Z',
  },
  {
    id: 'triangle',
    kind: 'fill',
    category: 'basic',
    path: polygon([
      [0, -50],
      [50, 50],
      [-50, 50],
    ]),
  },
  {
    id: 'diamond',
    kind: 'fill',
    category: 'basic',
    path: polygon([
      [0, -50],
      [50, 0],
      [0, 50],
      [-50, 0],
    ]),
  },
  { id: 'hexagon', kind: 'fill', category: 'basic', path: regular(6, 50, 0) },
  { id: 'star', kind: 'fill', category: 'basic', path: star(5, 50, 21) },
  {
    id: 'line',
    kind: 'fill',
    category: 'stripes',
    path: polygon([
      [-50, -2],
      [50, -2],
      [50, 2],
      [-50, 2],
    ]),
  },
  {
    id: 'stripe',
    kind: 'fill',
    category: 'stripes',
    path: polygon([
      [-50, -8],
      [50, -8],
      [50, 8],
      [-50, 8],
    ]),
  },
  {
    id: 'slash_stripe',
    kind: 'fill',
    category: 'stripes',
    path: polygon([
      [-30, -50],
      [50, -50],
      [30, 50],
      [-50, 50],
    ]),
  },
  { id: 'curved_stripe', kind: 'fill', category: 'stripes', path: arcBand() },
  {
    id: 'gradient_stripe',
    kind: 'gradient',
    category: 'stripes',
    path: polygon([
      [-50, -10],
      [50, -10],
      [50, 10],
      [-50, 10],
    ]),
  },
  {
    id: 'arrow',
    kind: 'fill',
    category: 'graphics',
    path: polygon([
      [-50, -14],
      [10, -14],
      [10, -40],
      [50, 0],
      [10, 40],
      [10, 14],
      [-50, 14],
    ]),
  },
  {
    id: 'chevron',
    kind: 'fill',
    category: 'graphics',
    path: polygon([
      [-50, -50],
      [-10, -50],
      [50, 0],
      [-10, 50],
      [-50, 50],
      [10, 0],
    ]),
  },
  {
    id: 'lightning',
    kind: 'fill',
    category: 'graphics',
    path: polygon([
      [12, -50],
      [-34, 6],
      [-4, 6],
      [-16, 50],
      [34, -10],
      [4, -10],
    ]),
  },
  // Alev parçaları: sağa doğru yalayan dilller (birlikte katmanlanınca alev oluşturur)
  {
    id: 'flame_tongue',
    kind: 'fill',
    category: 'graphics',
    path: 'M-50,20 C-30,-10 0,-30 50,-6 C10,-8 -4,4 18,10 C-6,8 -20,22 -6,32 C-24,32 -40,30 -50,20 Z',
  },
  {
    id: 'flame_lick',
    kind: 'fill',
    category: 'graphics',
    path: 'M-50,10 C-20,-30 20,-44 50,-30 C22,-26 6,-14 30,-4 C4,-2 -10,8 8,18 C-16,20 -36,22 -50,10 Z',
  },
  {
    id: 'flame_burst',
    kind: 'fill',
    category: 'graphics',
    path: 'M-50,0 C-36,-30 -10,-48 14,-40 C0,-30 -2,-22 20,-24 C10,-14 14,-8 50,-12 C30,4 30,10 46,20 C20,22 6,30 10,46 C-10,30 -22,40 -50,0 Z',
  },
  { id: 'checker', kind: 'fill', category: 'graphics', path: checker(4) },
];

const GLYPH_SHAPES: VinylShape[] = [
  ...'0123456789'.split('').map((c) => ({
    id: `digit_${c}`,
    kind: 'glyph' as const,
    char: c,
    category: 'digits' as const,
  })),
  ...'ABCÇDEFGĞHIİJKLMNOÖPQRSŞTUÜVWXYZ-.!/#'.split('').map((c) => ({
    id: `letter_${c}`,
    kind: 'glyph' as const,
    char: c,
    category: 'letters' as const,
  })),
];

export const VINYL_SHAPES: VinylShape[] = [...FILL_SHAPES, ...GLYPH_SHAPES];

const byId = new Map(VINYL_SHAPES.map((s) => [s.id, s]));

export const getVinylShape = (id: string): VinylShape | undefined => byId.get(id);
/** Kütüphane şekli veya yazı katmanı mı */
export const hasVinylShape = (id: string) => byId.has(id) || id === TEXT_SHAPE_ID;
export const DEFAULT_SHAPE_ID = 'circle';

/** Glyph şekillerinin fonttaki karşılığı var mı (test için) */
export const glyphExists = (c: string) => c in GLYPHS;

/** Şeklin doğal en-boy oranı: yerleştirirken orantısız görünmesin diye scale[0] buna göre. */
export function shapeAspect(shapeId: string, text?: string, fontId?: string): number {
  if (shapeId === TEXT_SHAPE_ID) return layoutText(text ?? '', fontId)?.aspect ?? 1;
  const s = byId.get(shapeId);
  if (!s) return 1;
  if (s.kind === 'glyph') return layoutText(s.char)?.aspect ?? 1;
  return s.aspect ?? 1;
}

/** Karakterin kütüphanedeki harf/rakam şekli (yazıyı şekle dönüştürmek için). */
export function glyphShapeId(char: string): string | null {
  const id = /[0-9]/.test(char) ? `digit_${char}` : `letter_${char}`;
  return byId.has(id) ? id : null;
}
