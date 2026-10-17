import { normalizeHex } from '../color/color';
import { vinylConfig } from './projection';
import { MASK_MODES, VINYL_SIDES, type MaskMode, type VinylLayer, type VinylSide } from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const pair = (v: unknown, fallback: [number, number]): [number, number] =>
  Array.isArray(v) && v.length === 2 ? [num(v[0], fallback[0]), num(v[1], fallback[1])] : fallback;

let counter = 0;
/** Oturum içinde benzersiz, kayıtlarla çakışmayan kısa id. */
export function newLayerId(): string {
  counter = (counter + 1) % 1e6;
  return `v${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Bilinmeyen veriyi geçerli bir katmana çevirir; şekil yoksa null. */
export function sanitizeLayer(input: unknown, isShape: (id: string) => boolean): VinylLayer | null {
  if (!isObj(input) || typeof input.shapeId !== 'string' || !isShape(input.shapeId)) return null;
  const { scale: sl, skew: kl } = vinylConfig.limits;
  const scale = pair(input.scale, vinylConfig.defaults.scale);
  const skew = pair(input.skew, [0, 0]);
  const position = pair(input.position, [0.5, 0.5]);
  const layer: VinylLayer = {
    id: typeof input.id === 'string' && input.id ? input.id : newLayerId(),
    shapeId: input.shapeId,
    side: VINYL_SIDES.includes(input.side as VinylSide) ? (input.side as VinylSide) : 'left',
    position: [clamp(position[0], -0.5, 1.5), clamp(position[1], -0.5, 1.5)],
    rotationDeg: ((num(input.rotationDeg, 0) % 360) + 360) % 360,
    scale: [clamp(scale[0], sl.min, sl.max), clamp(scale[1], sl.min, sl.max)],
    skew: [clamp(skew[0], kl.min, kl.max), clamp(skew[1], kl.min, kl.max)],
    color:
      (typeof input.color === 'string' && normalizeHex(input.color)) || vinylConfig.defaults.color,
    opacity: clamp(num(input.opacity, 1), 0, 1),
    flipX: input.flipX === true,
    flipY: input.flipY === true,
    mirrorToOppositeSide: input.mirrorToOppositeSide === true,
    maskMode: MASK_MODES.includes(input.maskMode as MaskMode)
      ? (input.maskMode as MaskMode)
      : 'none',
    visible: input.visible !== false,
    locked: input.locked === true,
  };
  if (typeof input.groupId === 'string' && input.groupId) layer.groupId = input.groupId;
  return layer;
}

/** Katman listesini doğrular; tekrar eden id'leri yeniler, limiti uygular. */
export function sanitizeLayers(input: unknown, isShape: (id: string) => boolean): VinylLayer[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: VinylLayer[] = [];
  for (const raw of input) {
    const layer = sanitizeLayer(raw, isShape);
    if (!layer) continue;
    if (seen.has(layer.id)) layer.id = newLayerId();
    seen.add(layer.id);
    out.push(layer);
    if (out.length >= vinylConfig.layerLimit) break;
  }
  return out;
}

export function createLayer(
  shapeId: string,
  side: VinylSide,
  position: [number, number],
  overrides: Partial<VinylLayer> = {},
): VinylLayer {
  return {
    id: newLayerId(),
    shapeId,
    side,
    position,
    rotationDeg: 0,
    scale: [...vinylConfig.defaults.scale],
    skew: [0, 0],
    color: vinylConfig.defaults.color,
    opacity: 1,
    flipX: false,
    flipY: false,
    mirrorToOppositeSide: false,
    maskMode: 'none',
    visible: true,
    locked: false,
    ...overrides,
  };
}

export class LayerLimitError extends Error {
  constructor() {
    super(`Katman limiti (${vinylConfig.layerLimit}) doldu`);
    this.name = 'LayerLimitError';
  }
}

/** Listenin sonu = en üstteki katman. */
export function addLayer(layers: VinylLayer[], layer: VinylLayer): VinylLayer[] {
  if (layers.length >= vinylConfig.layerLimit) throw new LayerLimitError();
  return [...layers, layer];
}

export function removeLayer(layers: VinylLayer[], id: string): VinylLayer[] {
  return layers.filter((l) => l.id !== id);
}

/** Kopyayı orijinalin hemen üstüne, biraz kaydırılmış olarak ekler. */
export function duplicateLayer(
  layers: VinylLayer[],
  id: string,
  offset: [number, number] = [0.02, -0.02],
): { layers: VinylLayer[]; copyId: string | null } {
  const i = layers.findIndex((l) => l.id === id);
  const src = layers[i];
  if (!src) return { layers, copyId: null };
  if (layers.length >= vinylConfig.layerLimit) throw new LayerLimitError();
  const copy: VinylLayer = {
    ...src,
    id: newLayerId(),
    position: [src.position[0] + offset[0], src.position[1] + offset[1]],
    locked: false,
  };
  return { layers: [...layers.slice(0, i + 1), copy, ...layers.slice(i + 1)], copyId: copy.id };
}

export type MoveDirection = 'up' | 'down' | 'top' | 'bottom';

export function moveLayer(layers: VinylLayer[], id: string, dir: MoveDirection): VinylLayer[] {
  const i = layers.findIndex((l) => l.id === id);
  const layer = layers[i];
  if (!layer) return layers;
  const rest = layers.filter((l) => l.id !== id);
  const target =
    dir === 'top'
      ? rest.length
      : dir === 'bottom'
        ? 0
        : dir === 'up'
          ? Math.min(rest.length, i + 1)
          : Math.max(0, i - 1);
  if (target === i) return layers;
  return [...rest.slice(0, target), layer, ...rest.slice(target)];
}

export function updateLayer(
  layers: VinylLayer[],
  id: string,
  patch: Partial<Omit<VinylLayer, 'id'>>,
): VinylLayer[] {
  return layers.map((l) => (l.id === id ? { ...l, ...patch } : l));
}
