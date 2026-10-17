import { newLayerId, LayerLimitError } from './layers';
import { layerCornersUV, vinylConfig, type ProjectionSurface } from './projection';
import type { VinylLayer, VinylSide } from './types';

/**
 * Çoklu seçim ve gruplar (saf). Grup = aynı groupId'ye sahip katmanlar; üyeler katman
 * sırasında hep bitişik tutulur ki grup tek bir parça gibi sıralanabilsin.
 */

/** Bir katmana tıklanınca seçilecek id'ler: grup üyesiyse tüm grup. */
export function selectionFor(layers: VinylLayer[], id: string, single = false): string[] {
  const layer = layers.find((l) => l.id === id);
  if (!layer) return [];
  if (single || !layer.groupId) return [id];
  return layers.filter((l) => l.groupId === layer.groupId).map((l) => l.id);
}

/** Seçimi grup üyelerini kapsayacak şekilde genişletir (sıra korunur). */
export function expandToGroups(layers: VinylLayer[], ids: string[]): string[] {
  const groups = new Set(
    layers.filter((l) => ids.includes(l.id) && l.groupId).map((l) => l.groupId),
  );
  return layers
    .filter((l) => ids.includes(l.id) || (l.groupId && groups.has(l.groupId)))
    .map((l) => l.id);
}

/** Seçili katmanları tek grup yapar; üyeler en üstteki üyenin konumunda bitişik toplanır. */
export function groupLayers(
  layers: VinylLayer[],
  ids: string[],
): { layers: VinylLayer[]; groupId: string | null } {
  const set = new Set(ids);
  const members = layers.filter((l) => set.has(l.id));
  if (members.length < 2) return { layers, groupId: null };
  const groupId = newLayerId().replace(/^v/, 'g');
  const topIndex = Math.max(...members.map((m) => layers.indexOf(m)));
  const rest = layers.filter((l) => !set.has(l.id));
  // Üstteki üyenin altında kalan seçili olmayan katman sayısı
  const insertAt = layers.slice(0, topIndex + 1).filter((l) => !set.has(l.id)).length;
  const grouped = members.map((m) => ({ ...m, groupId }));
  return { layers: [...rest.slice(0, insertAt), ...grouped, ...rest.slice(insertAt)], groupId };
}

export function ungroupLayers(layers: VinylLayer[], ids: string[]): VinylLayer[] {
  const groups = new Set(
    layers.filter((l) => ids.includes(l.id) && l.groupId).map((l) => l.groupId),
  );
  return layers.map((l) => {
    if (!l.groupId || !groups.has(l.groupId)) return l;
    const { groupId: _g, ...rest } = l;
    return rest;
  });
}

export function removeLayers(layers: VinylLayer[], ids: string[]): VinylLayer[] {
  const set = new Set(ids);
  return layers.filter((l) => !set.has(l.id));
}

/**
 * Seçimi çoğaltır: kopyalar en üstteki seçili katmanın hemen üstüne, biraz kaydırılmış
 * olarak eklenir. Kopyalanan gruplar yeni grup kimliği alır.
 */
export function duplicateLayers(
  layers: VinylLayer[],
  ids: string[],
  offset: [number, number] = [0.02, -0.02],
): { layers: VinylLayer[]; copyIds: string[] } {
  const set = new Set(ids);
  const members = layers.filter((l) => set.has(l.id));
  if (members.length === 0) return { layers, copyIds: [] };
  if (layers.length + members.length > vinylConfig.layerLimit) throw new LayerLimitError();
  const groupMap = new Map<string, string>();
  const copies = members.map((m) => {
    const copy: VinylLayer = {
      ...m,
      id: newLayerId(),
      position: [m.position[0] + offset[0], m.position[1] + offset[1]],
      locked: false,
    };
    if (m.groupId) {
      if (!groupMap.has(m.groupId)) groupMap.set(m.groupId, newLayerId().replace(/^v/, 'g'));
      copy.groupId = groupMap.get(m.groupId);
    }
    return copy;
  });
  const top = Math.max(...members.map((m) => layers.indexOf(m)));
  return {
    layers: [...layers.slice(0, top + 1), ...copies, ...layers.slice(top + 1)],
    copyIds: copies.map((c) => c.id),
  };
}

export type MoveDirection = 'up' | 'down' | 'top' | 'bottom';

/**
 * Seçimi blok olarak sıralar. 'up'/'down' blok, seçili olmayan bir sonraki katmanın (veya
 * grubun) öbür yanına geçer.
 */
export function moveLayers(layers: VinylLayer[], ids: string[], dir: MoveDirection): VinylLayer[] {
  const set = new Set(ids);
  const block = layers.filter((l) => set.has(l.id));
  if (block.length === 0) return layers;
  const rest = layers.filter((l) => !set.has(l.id));
  const first = layers.indexOf(block[0] as VinylLayer);
  const below = layers.slice(0, first).filter((l) => !set.has(l.id)).length;
  let at: number;
  if (dir === 'top') at = rest.length;
  else if (dir === 'bottom') at = 0;
  else if (dir === 'up') {
    const next = rest[below];
    if (!next) return layers;
    // Sıradaki bir grupsa grubun tamamının üstüne çık
    let span = 1;
    if (next.groupId) while (rest[below + span]?.groupId === next.groupId) span++;
    at = below + span;
  } else {
    const prev = rest[below - 1];
    if (!prev) return layers;
    let span = 1;
    if (prev.groupId) while (rest[below - 1 - span]?.groupId === prev.groupId) span++;
    at = below - span;
  }
  const out = [...rest.slice(0, at), ...block, ...rest.slice(at)];
  return out.every((l, i) => l === layers[i]) ? layers : out;
}

/** Seçimin ortak yüzü (hepsi aynı yüzdeyse), yoksa null — grup dönüşümü tek yüzde yapılır. */
export function commonSide(layers: VinylLayer[], ids: string[]): VinylSide | null {
  const sides = new Set(layers.filter((l) => ids.includes(l.id)).map((l) => l.side));
  return sides.size === 1 ? ([...sides][0] as VinylSide) : null;
}

/** Seçimin yüzey (u, v) sınır kutusu: [minU, minV, maxU, maxV]. */
export function selectionBounds(
  layers: VinylLayer[],
  ids: string[],
  surface: ProjectionSurface,
): [number, number, number, number] | null {
  const corners = layers
    .filter((l) => ids.includes(l.id))
    .flatMap((l) => layerCornersUV(l, surface));
  if (corners.length === 0) return null;
  const us = corners.map((c) => c[0]);
  const vs = corners.map((c) => c[1]);
  return [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)];
}

export type GroupHandle = 'move' | 'rotate' | 'scale';

/**
 * Grup dönüşümü: taşı, grup merkezi etrafında döndür, eşit ölçekle. Hesaplar yüzey
 * metresinde yapılır (en-boy oranı bozulmaz). `start` sürükleme başındaki katmanlardır.
 */
export function transformGroup(
  start: VinylLayer[],
  ids: string[],
  surface: ProjectionSurface,
  handle: GroupHandle,
  startUV: [number, number],
  uv: [number, number],
  snapAngleDeg = 0,
): VinylLayer[] {
  const bounds = selectionBounds(start, ids, surface);
  if (!bounds) return start;
  const set = new Set(ids);
  const W = surface.widthM;
  const H = surface.heightM;
  const cx = ((bounds[0] + bounds[2]) / 2) * W;
  const cy = ((bounds[1] + bounds[3]) / 2) * H;
  const { scale: sl } = vinylConfig.limits;

  if (handle === 'move') {
    const du = uv[0] - startUV[0];
    const dv = uv[1] - startUV[1];
    return start.map((l) =>
      set.has(l.id) ? { ...l, position: [l.position[0] + du, l.position[1] + dv] } : l,
    );
  }

  if (handle === 'rotate') {
    const angle = (p: [number, number]) => Math.atan2(p[1] * H - cy, p[0] * W - cx);
    let deg = ((angle(uv) - angle(startUV)) * 180) / Math.PI;
    if (snapAngleDeg > 0) deg = Math.round(deg / snapAngleDeg) * snapAngleDeg;
    const r = (deg * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    return start.map((l) => {
      if (!set.has(l.id)) return l;
      const x = l.position[0] * W - cx;
      const y = l.position[1] * H - cy;
      return {
        ...l,
        position: [(cx + x * cos - y * sin) / W, (cy + x * sin + y * cos) / H],
        rotationDeg: (((l.rotationDeg + deg) % 360) + 360) % 360,
      };
    });
  }

  // Eşit ölçek: merkeze uzaklık oranı
  const dist = (p: [number, number]) => Math.hypot(p[0] * W - cx, p[1] * H - cy);
  const k = dist(uv) / Math.max(1e-6, dist(startUV));
  const clampK = (s: number) => Math.min(sl.max, Math.max(sl.min, s * k)) / s;
  // Hiçbir üye sınırı aşmasın: en kısıtlayıcı oranı kullan
  const kk = start
    .filter((l) => set.has(l.id))
    .reduce((acc, l) => {
      const a = clampK(l.scale[0]);
      const b = clampK(l.scale[1]);
      return k >= 1 ? Math.min(acc, a, b) : Math.max(acc, a, b);
    }, k);
  return start.map((l) => {
    if (!set.has(l.id)) return l;
    const x = l.position[0] * W - cx;
    const y = l.position[1] * H - cy;
    return {
      ...l,
      position: [(cx + x * kk) / W, (cy + y * kk) / H],
      scale: [l.scale[0] * kk, l.scale[1] * kk],
    };
  });
}

/** Klavye ile kaydırma (nudge), yüzey birimi. */
export function nudgeLayers(
  layers: VinylLayer[],
  ids: string[],
  du: number,
  dv: number,
): VinylLayer[] {
  const set = new Set(ids);
  return layers.map((l) =>
    set.has(l.id) && !l.locked ? { ...l, position: [l.position[0] + du, l.position[1] + dv] } : l,
  );
}

/**
 * Mıknatıs: konumu ızgaraya ve orta çizgiye (u = 0.5) yakalar. Orta çizgi, simetrik
 * desenlerin araç ekseninde hizalanması için önce denenir.
 */
export function snapPosition(
  p: [number, number],
  grid: number,
  centerTolerance: number,
): [number, number] {
  const u = Math.abs(p[0] - 0.5) <= centerTolerance ? 0.5 : Math.round(p[0] / grid) * grid;
  const v = Math.round(p[1] / grid) * grid;
  return [Number(u.toFixed(6)), Number(v.toFixed(6))];
}
