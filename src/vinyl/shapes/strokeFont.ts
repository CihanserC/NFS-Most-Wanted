import { toUpperLocale } from '../../i18n';
/**
 * Orijinal "yarış" çizgi fontu. Her karakter 4×6'lık ızgarada (x sağa, y aşağı) bir veya
 * daha fazla çizgi (polyline) iskeletidir; kalem kalınlığı ve uç/birleşim stili font
 * stilinden gelir. Böylece harfler ve rakamlar da vektör şekil olarak çizilir ve
 * birkaç font stili aynı iskeleti paylaşır.
 */
export type Point = [number, number];
export type Polyline = Point[];

const GLYPH_WIDTH = 4;
const GLYPH_HEIGHT = 6;
const LETTER_SPACING = 1.7;
const SPACE_ADVANCE = 3;

/** Izgarada aksan yükseklikleri (Türkçe karakterler için) */
const DOTS: Polyline[] = [
  [
    [1, -1.5],
    [1, -1.1],
  ],
  [
    [3, -1.5],
    [3, -1.1],
  ],
];
const CEDILLA: Polyline = [
  [2, 6.2],
  [2.4, 7.1],
  [1.4, 7.8],
];
const BREVE: Polyline = [
  [1, -1.9],
  [2, -1.1],
  [3, -1.9],
];

const BOX: Polyline = [
  [0, 0],
  [4, 0],
  [4, 6],
  [0, 6],
  [0, 0],
];

export const GLYPHS: Record<string, Polyline[]> = {
  '0': [
    BOX,
    [
      [0.6, 5.4],
      [3.4, 0.6],
    ],
  ],
  '1': [
    [
      [1, 1.2],
      [2.4, 0],
      [2.4, 6],
    ],
  ],
  '2': [
    [
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
      [0, 6],
      [4, 6],
    ],
  ],
  '3': [
    [
      [0, 0],
      [4, 0],
      [4, 6],
      [0, 6],
    ],
    [
      [1.2, 3],
      [4, 3],
    ],
  ],
  '4': [
    [
      [0, 0],
      [0, 3.5],
      [4, 3.5],
    ],
    [
      [3, 1.5],
      [3, 6],
    ],
  ],
  '5': [
    [
      [4, 0],
      [0, 0],
      [0, 2.6],
      [3, 2.6],
      [4, 3.6],
      [4, 6],
      [0, 6],
    ],
  ],
  '6': [
    [
      [4, 0],
      [0, 0],
      [0, 6],
      [4, 6],
      [4, 3],
      [0, 3],
    ],
  ],
  '7': [
    [
      [0, 0],
      [4, 0],
      [1.6, 6],
    ],
  ],
  '8': [
    BOX,
    [
      [0, 3],
      [4, 3],
    ],
  ],
  '9': [
    [
      [4, 3],
      [0, 3],
      [0, 0],
      [4, 0],
      [4, 6],
      [0, 6],
    ],
  ],
  A: [
    [
      [0, 6],
      [0, 1.2],
      [1.2, 0],
      [4, 0],
      [4, 6],
    ],
    [
      [0, 3.4],
      [4, 3.4],
    ],
  ],
  B: [
    [
      [0, 0],
      [3, 0],
      [4, 1],
      [4, 2],
      [3, 3],
      [4, 4],
      [4, 5],
      [3, 6],
      [0, 6],
      [0, 0],
    ],
    [
      [0, 3],
      [3, 3],
    ],
  ],
  C: [
    [
      [4, 0],
      [0, 0],
      [0, 6],
      [4, 6],
    ],
  ],
  D: [
    [
      [0, 0],
      [2.8, 0],
      [4, 1.2],
      [4, 4.8],
      [2.8, 6],
      [0, 6],
      [0, 0],
    ],
  ],
  E: [
    [
      [4, 0],
      [0, 0],
      [0, 6],
      [4, 6],
    ],
    [
      [0, 3],
      [3, 3],
    ],
  ],
  F: [
    [
      [4, 0],
      [0, 0],
      [0, 6],
    ],
    [
      [0, 3],
      [3, 3],
    ],
  ],
  G: [
    [
      [4, 0],
      [0, 0],
      [0, 6],
      [4, 6],
      [4, 3],
      [2, 3],
    ],
  ],
  H: [
    [
      [0, 0],
      [0, 6],
    ],
    [
      [4, 0],
      [4, 6],
    ],
    [
      [0, 3],
      [4, 3],
    ],
  ],
  I: [
    [
      [2, 0],
      [2, 6],
    ],
    [
      [0.8, 0],
      [3.2, 0],
    ],
    [
      [0.8, 6],
      [3.2, 6],
    ],
  ],
  J: [
    [
      [4, 0],
      [4, 6],
      [0, 6],
      [0, 4],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 6],
    ],
    [
      [4, 0],
      [0, 3.2],
      [4, 6],
    ],
  ],
  L: [
    [
      [0, 0],
      [0, 6],
      [4, 6],
    ],
  ],
  M: [
    [
      [0, 6],
      [0, 0],
      [2, 2.8],
      [4, 0],
      [4, 6],
    ],
  ],
  N: [
    [
      [0, 6],
      [0, 0],
      [4, 6],
      [4, 0],
    ],
  ],
  O: [BOX],
  P: [
    [
      [0, 6],
      [0, 0],
      [4, 0],
      [4, 3.2],
      [0, 3.2],
    ],
  ],
  Q: [
    BOX,
    [
      [2.4, 4.4],
      [4.4, 6.6],
    ],
  ],
  R: [
    [
      [0, 6],
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ],
    [
      [1.8, 3],
      [4, 6],
    ],
  ],
  S: [
    [
      [4, 0],
      [0, 0],
      [0, 3],
      [4, 3],
      [4, 6],
      [0, 6],
    ],
  ],
  T: [
    [
      [0, 0],
      [4, 0],
    ],
    [
      [2, 0],
      [2, 6],
    ],
  ],
  U: [
    [
      [0, 0],
      [0, 6],
      [4, 6],
      [4, 0],
    ],
  ],
  V: [
    [
      [0, 0],
      [2, 6],
      [4, 0],
    ],
  ],
  W: [
    [
      [0, 0],
      [1, 6],
      [2, 2.6],
      [3, 6],
      [4, 0],
    ],
  ],
  X: [
    [
      [0, 0],
      [4, 6],
    ],
    [
      [4, 0],
      [0, 6],
    ],
  ],
  Y: [
    [
      [0, 0],
      [2, 3],
      [4, 0],
    ],
    [
      [2, 3],
      [2, 6],
    ],
  ],
  Z: [
    [
      [0, 0],
      [4, 0],
      [0, 6],
      [4, 6],
    ],
  ],
  '-': [
    [
      [0.6, 3],
      [3.4, 3],
    ],
  ],
  '.': [
    [
      [2, 5.6],
      [2, 6],
    ],
  ],
  '!': [
    [
      [2, 0],
      [2, 4],
    ],
    [
      [2, 5.6],
      [2, 6],
    ],
  ],
  '/': [
    [
      [0.4, 6],
      [3.6, 0],
    ],
  ],
  '#': [
    [
      [1.3, 0.6],
      [0.8, 5.4],
    ],
    [
      [3.2, 0.6],
      [2.7, 5.4],
    ],
    [
      [0.2, 2.2],
      [3.8, 2.2],
    ],
    [
      [0.1, 3.9],
      [3.7, 3.9],
    ],
  ],
};

// Türkçe büyük harfler: Latin iskelet + aksan
GLYPHS['Ç'] = [...(GLYPHS.C as Polyline[]), CEDILLA];
GLYPHS['Ş'] = [...(GLYPHS.S as Polyline[]), CEDILLA];
GLYPHS['Ğ'] = [...(GLYPHS.G as Polyline[]), BREVE];
GLYPHS['Ö'] = [...(GLYPHS.O as Polyline[]), ...DOTS];
GLYPHS['Ü'] = [...(GLYPHS.U as Polyline[]), ...DOTS];
GLYPHS['İ'] = [
  ...(GLYPHS.I as Polyline[]),
  [
    [2, -1.5],
    [2, -1.1],
  ],
];

export type StrokeFontStyle = {
  id: string;
  /** Kalem kalınlığı, ızgara birimi */
  weight: number;
  cap: CanvasLineCap;
  join: CanvasLineJoin;
  /** İtalik: y yukarı çıktıkça x'e eklenen kayma oranı */
  slant: number;
};

export const STROKE_FONTS: StrokeFontStyle[] = [
  { id: 'block', weight: 1.35, cap: 'square', join: 'miter', slant: 0 },
  { id: 'round', weight: 1.2, cap: 'round', join: 'round', slant: 0 },
  { id: 'thin', weight: 0.6, cap: 'round', join: 'round', slant: 0 },
  { id: 'speed', weight: 1.25, cap: 'butt', join: 'miter', slant: 0.24 },
];
export const DEFAULT_FONT_ID = 'block';

export const getStrokeFont = (id: string | undefined): StrokeFontStyle =>
  STROKE_FONTS.find((f) => f.id === id) ?? (STROKE_FONTS[0] as StrokeFontStyle);

/** Türkçe büyük harfe çevirir (i -> İ, ı -> I) ve fontta olmayan karakterleri atar. */
export function normalizeText(text: string): string {
  return [...toUpperLocale(text)].filter((c) => c === ' ' || c in GLYPHS).join('');
}

export type TextLayout = {
  /**
   * Yerel birim kutuda (x, y ∈ [-0.5, 0.5], y yukarı) çizgiler. Kutu, kalem kalınlığı dahil
   * metnin tamamını kapsar.
   */
  polylines: Polyline[];
  /** Kutu genişliği / yüksekliği (doğal en-boy oranı; katmanın scale[0]/scale[1] oranı) */
  aspect: number;
  /** Kalem kalınlığı, kutu yüksekliğine oranla */
  weight: number;
  /** Her karakterin merkezi (yerel birim kutuda) ve 6 birimlik harf yüksekliğinin kutu yüksekliğine oranı */
  glyphs: { char: string; center: Point }[];
  glyphHeight: number;
  cap: CanvasLineCap;
  join: CanvasLineJoin;
};

/** Metni çizgi iskeletine yerleştirir ve yerel birim kutuya normalize eder. */
export function layoutText(text: string, fontId?: string): TextLayout | null {
  const font = getStrokeFont(fontId);
  const chars = [...normalizeText(text)];
  const raw: Polyline[] = [];
  const centers: { char: string; center: Point }[] = [];
  let x = 0;
  for (const c of chars) {
    if (c === ' ') {
      x += SPACE_ADVANCE;
      continue;
    }
    centers.push({
      char: c,
      center: [x + GLYPH_WIDTH / 2 + (GLYPH_HEIGHT / 2) * font.slant, GLYPH_HEIGHT / 2],
    });
    for (const line of GLYPHS[c] ?? [])
      raw.push(line.map(([gx, gy]) => [x + gx + (GLYPH_HEIGHT - gy) * font.slant, gy]));
    x += GLYPH_WIDTH + LETTER_SPACING;
  }
  if (raw.length === 0) return null;

  const half = font.weight / 2;
  const xs = raw.flatMap((l) => l.map((p) => p[0]));
  const ys = raw.flatMap((l) => l.map((p) => p[1]));
  const minX = Math.min(...xs) - half;
  const maxX = Math.max(...xs) + half;
  const minY = Math.min(...ys) - half;
  const maxY = Math.max(...ys) + half;
  const w = maxX - minX;
  const h = maxY - minY;
  return {
    polylines: raw.map((l) => l.map(([px, py]) => [(px - minX) / w - 0.5, 0.5 - (py - minY) / h])),
    aspect: w / h,
    weight: font.weight / h,
    glyphs: centers.map(({ char, center: [cx, cy] }) => ({
      char,
      center: [(cx - minX) / w - 0.5, 0.5 - (cy - minY) / h] as Point,
    })),
    glyphHeight: (GLYPH_HEIGHT + font.weight) / h,
    cap: font.cap,
    join: font.join,
  };
}
