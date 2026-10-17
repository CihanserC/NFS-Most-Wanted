/**
 * Vinil şekil kütüphanesi. Her şekil, merkezi orijinde olan 100×100'lük kutuda
 * (-50..50) SVG path verisidir; y aşağı doğru artar (SVG/canvas düzeni).
 * Hepsi orijinal, basit geometrik çizimler. Faz 6'da kütüphane genişletilecek.
 */
export type VinylShape = {
  id: string;
  path: string;
  /** Doldurma kuralı: delikli şekiller için evenodd */
  fillRule?: 'nonzero' | 'evenodd';
};

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

export const VINYL_SHAPES: VinylShape[] = [
  { id: 'circle', path: circle(50) },
  { id: 'ring', path: `${circle(50)} ${circle(34)}`, fillRule: 'evenodd' },
  {
    id: 'square',
    path: polygon([
      [-50, -50],
      [50, -50],
      [50, 50],
      [-50, 50],
    ]),
  },
  {
    id: 'rounded_square',
    path: 'M-34,-50 H34 A16,16 0 0 1 50,-34 V34 A16,16 0 0 1 34,50 H-34 A16,16 0 0 1 -50,34 V-34 A16,16 0 0 1 -34,-50 Z',
  },
  {
    id: 'triangle',
    path: polygon([
      [0, -50],
      [50, 50],
      [-50, 50],
    ]),
  },
  {
    id: 'diamond',
    path: polygon([
      [0, -50],
      [50, 0],
      [0, 50],
      [-50, 0],
    ]),
  },
  { id: 'hexagon', path: regular(6, 50, 0) },
  { id: 'star', path: star(5, 50, 21) },
  {
    id: 'stripe',
    path: polygon([
      [-50, -8],
      [50, -8],
      [50, 8],
      [-50, 8],
    ]),
  },
  {
    id: 'slash_stripe',
    path: polygon([
      [-30, -50],
      [50, -50],
      [30, 50],
      [-50, 50],
    ]),
  },
  {
    id: 'arrow',
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
    path: polygon([
      [12, -50],
      [-34, 6],
      [-4, 6],
      [-16, 50],
      [34, -10],
      [4, -10],
    ]),
  },
];

const byId = new Map(VINYL_SHAPES.map((s) => [s.id, s]));

export const getVinylShape = (id: string): VinylShape | undefined => byId.get(id);
export const hasVinylShape = (id: string) => byId.has(id);
export const DEFAULT_SHAPE_ID = 'circle';
