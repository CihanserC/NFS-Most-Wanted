import { describe, expect, it } from 'vitest';
import { getCar } from '../../data/cars';
import { hasVinylShape, VINYL_SHAPES } from '../../vinyl/shapes/library';
import { createDefaultBuild, withVinyl } from '../build/build';
import { deserializeBuild, serializeBuild } from '../build/serialize';
import { createBuildStore } from '../store/buildStore';
import { dragLayer } from './gizmo';
import {
  addLayer,
  createLayer,
  duplicateLayer,
  LayerLimitError,
  moveLayer,
  removeLayer,
  sanitizeLayers,
  updateLayer,
} from './layers';
import {
  applyAffine,
  canvasTransform,
  carToSurface,
  dominantSide,
  hitTestLayers,
  instancesBySide,
  invertAffine,
  layerCornersUV,
  layerTransform,
  surfaceToCar,
  vinylConfig,
} from './projection';
import { VINYL_SIDES, type VinylLayer } from './types';

const car = getCar('vanta_stallion_70');
const box = car.vinylBox;
const close = (a: number[], b: number[], digits = 6) =>
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i] as number, digits));

describe('kutu projeksiyonu', () => {
  it('yüzey <-> car-space dönüşümü tutarlı (her yüz)', () => {
    for (const side of VINYL_SIDES)
      for (const uv of [
        [0.1, 0.2],
        [0.5, 0.5],
        [0.93, 0.71],
      ] as [number, number][])
        close(carToSurface(box, side, surfaceToCar(box, side, uv[0], uv[1])), uv);
  });

  it('yüze dışarıdan bakan için u sağa artar', () => {
    // Sol yüz (+X'ten bakış): burun solda (u küçük), arka sağda.
    expect(carToSurface(box, 'left', [1, 0.5, 2])[0]).toBeLessThan(
      carToSurface(box, 'left', [1, 0.5, -2])[0],
    );
    // Sağ yüz: tersi.
    expect(carToSurface(box, 'right', [-1, 0.5, 2])[0]).toBeGreaterThan(
      carToSurface(box, 'right', [-1, 0.5, -2])[0],
    );
    // Ön yüz (önden bakış): aracın solu (+X) sağda görünür.
    expect(carToSurface(box, 'front', [0.8, 0.5, 2.4])[0]).toBeGreaterThan(0.5);
  });

  it('aynı z için sol ve sağ yüzün u değerleri simetrik', () => {
    const [ul] = carToSurface(box, 'left', [1, 0.7, 1.3]);
    const [ur] = carToSurface(box, 'right', [-1, 0.7, 1.3]);
    expect(ul + ur).toBeCloseTo(1);
  });

  it('normal yönüne göre yüz seçimi; aşağı bakan yüz yok', () => {
    expect(dominantSide([0.9, 0.1, 0.2])).toBe('left');
    expect(dominantSide([-0.9, 0.1, 0.2])).toBe('right');
    expect(dominantSide([0.1, 0.95, 0.1])).toBe('top');
    expect(dominantSide([0.1, 0.2, 0.97])).toBe('front');
    expect(dominantSide([0.1, 0.2, -0.97])).toBe('rear');
    expect(dominantSide([0.1, -0.99, 0])).toBeNull();
  });

  it('kutu araç boyutlarını kapsar', () => {
    const d = car.manifest.dimensions;
    expect(box.halfLength * 2).toBeGreaterThan(d.length);
    expect(box.halfWidth * 2).toBeGreaterThan(d.width);
    expect(box.height).toBeGreaterThan(d.height);
  });
});

describe('katman dönüşümü', () => {
  const layer = (patch: Partial<VinylLayer> = {}) =>
    createLayer('square', 'left', [0.5, 0.5], { scale: [2, 1], ...patch });
  const surface = box.surfaces.left;

  it('ölçek fiziksel metre cinsinden (en-boy oranı yüzeye göre bozulmaz)', () => {
    const [bl, br, , tl] = layerCornersUV(layer(), surface);
    const widthM = ((br as number[])[0]! - (bl as number[])[0]!) * surface.widthM;
    const heightM = ((tl as number[])[1]! - (bl as number[])[1]!) * surface.heightM;
    expect(widthM).toBeCloseTo(2 * vinylConfig.baseShapeSizeM);
    expect(heightM).toBeCloseTo(vinylConfig.baseShapeSizeM);
  });

  it('dönüşüm ve tersi birim', () => {
    const m = layerTransform(layer({ rotationDeg: 33, skew: [0.3, -0.2], flipX: true }), surface);
    const inv = invertAffine(m)!;
    const p = applyAffine(m, 0.3, -0.4);
    close(applyAffine(inv, p[0], p[1]), [0.3, -0.4]);
  });

  it('canvas dönüşümü şeklin merkezini doğru piksele koyar (y aşağı)', () => {
    const l = createLayer('circle', 'left', [0.25, 0.75]);
    const [a, b, c, d, e, f] = canvasTransform(l, surface, 2048, 1024);
    close([a * 0 + c * 0 + e, b * 0 + d * 0 + f], [0.25 * 2048, 0.25 * 1024], 3);
  });

  it('simetri: sol katman sağ yüzde aynalanmış kopya üretir', () => {
    const l = createLayer('arrow', 'left', [0.2, 0.4], {
      rotationDeg: 30,
      mirrorToOppositeSide: true,
    });
    const inst = instancesBySide([l]);
    expect(inst.left).toHaveLength(1);
    expect(inst.right).toHaveLength(1);
    const m = inst.right[0]!.layer;
    expect(m.position[0]).toBeCloseTo(0.8);
    expect(m.rotationDeg).toBeCloseTo(-30);
    expect(m.flipX).toBe(true);
    expect(inst.right[0]!.source).toBe(l);
  });

  it('üst yüzde simetri aynı yüzde orta çizgiye göre kopya', () => {
    const l = createLayer('stripe', 'top', [0.3, 0.5], { mirrorToOppositeSide: true });
    const inst = instancesBySide([l]);
    expect(inst.top).toHaveLength(2);
    expect(inst.top[1]!.layer.position[0]).toBeCloseTo(0.7);
  });

  it('gizli katman çizilmez', () => {
    expect(
      instancesBySide([createLayer('circle', 'left', [0.5, 0.5], { visible: false })]).left,
    ).toEqual([]);
  });
});

describe('katman işlemleri', () => {
  const a = createLayer('circle', 'left', [0.2, 0.5]);
  const b = createLayer('square', 'left', [0.4, 0.5]);
  const c = createLayer('star', 'right', [0.6, 0.5]);
  const ids = (ls: VinylLayer[]) => ls.map((l) => l.id);

  it('ekle / sil / güncelle', () => {
    let ls = addLayer(addLayer([], a), b);
    expect(ids(ls)).toEqual([a.id, b.id]);
    ls = updateLayer(ls, a.id, { color: '#ff0000' });
    expect(ls[0]!.color).toBe('#ff0000');
    expect(ls[1]).toBe(b); // değişmeyen katman aynı nesne kalır (dokular yeniden çizilmez)
    expect(ids(removeLayer(ls, a.id))).toEqual([b.id]);
  });

  it('sıralama: yukarı, aşağı, en üst, en alt', () => {
    const ls = [a, b, c];
    expect(ids(moveLayer(ls, a.id, 'up'))).toEqual([b.id, a.id, c.id]);
    expect(ids(moveLayer(ls, c.id, 'down'))).toEqual([a.id, c.id, b.id]);
    expect(ids(moveLayer(ls, a.id, 'top'))).toEqual([b.id, c.id, a.id]);
    expect(ids(moveLayer(ls, c.id, 'bottom'))).toEqual([c.id, a.id, b.id]);
    expect(moveLayer(ls, c.id, 'top')).toBe(ls);
  });

  it('çoğaltma kopyayı hemen üstüne koyar', () => {
    const { layers, copyId } = duplicateLayer([a, b], a.id);
    expect(layers).toHaveLength(3);
    expect(layers[1]!.id).toBe(copyId);
    expect(layers[1]!.shapeId).toBe(a.shapeId);
  });

  it('katman limiti uygulanır', () => {
    const full = Array.from({ length: vinylConfig.layerLimit }, () =>
      createLayer('circle', 'left', [0.5, 0.5]),
    );
    expect(() => addLayer(full, a)).toThrow(LayerLimitError);
    expect(() => duplicateLayer(full, full[0]!.id)).toThrow(LayerLimitError);
  });

  it('kayıttan okuma: bozuk katmanlar atılır, değerler sınırlanır, tekrar eden id yenilenir', () => {
    const out = sanitizeLayers(
      [
        { ...a, scale: [999, -1], opacity: 4, rotationDeg: 725 },
        { ...a },
        { shapeId: 'yok', side: 'left' },
        'çöp',
      ],
      hasVinylShape,
    );
    expect(out).toHaveLength(2);
    expect(out[0]!.scale).toEqual([vinylConfig.limits.scale.max, vinylConfig.limits.scale.min]);
    expect(out[0]!.opacity).toBe(1);
    expect(out[0]!.rotationDeg).toBe(5);
    expect(out[1]!.id).not.toBe(out[0]!.id);
  });

  it('her şeklin geçerli bir SVG yolu var', () => {
    expect(VINYL_SHAPES.length).toBeGreaterThanOrEqual(10);
    for (const s of VINYL_SHAPES) if (s.kind !== 'glyph') expect(s.path).toMatch(/^M[-\d.,]/);
  });
});

describe('seçim (hit test)', () => {
  const big = createLayer('square', 'left', [0.5, 0.5], { scale: [2, 2] });
  const small = createLayer('circle', 'left', [0.5, 0.5]);
  const locked = createLayer('star', 'left', [0.8, 0.5], { locked: true });

  it('en üstteki katmanı seçer', () => {
    expect(hitTestLayers([big, small], box, 'left', [0.5, 0.5])).toBe(small.id);
    expect(hitTestLayers([small, big], box, 'left', [0.5, 0.5])).toBe(big.id);
  });

  it('boşluğa tıklama ve kilitli katman seçilmez', () => {
    expect(hitTestLayers([small], box, 'left', [0.05, 0.05])).toBeNull();
    expect(hitTestLayers([locked], box, 'left', [0.8, 0.5])).toBeNull();
  });

  it('ayna kopyasına tıklama kaynak katmanı seçer', () => {
    const m = createLayer('circle', 'left', [0.3, 0.5], { mirrorToOppositeSide: true });
    expect(hitTestLayers([m], box, 'right', [0.7, 0.5])).toBe(m.id);
  });
});

describe('gizmo sürükleme', () => {
  const surface = box.surfaces.left;
  const l = createLayer('square', 'left', [0.5, 0.5]);

  it('taşıma imleç farkı kadar kaydırır', () => {
    const next = dragLayer(
      { handle: 'move', layer: l, startUV: [0.4, 0.4] },
      surface,
      [0.45, 0.42],
    );
    close(next.position, [0.55, 0.52]);
  });

  it('köşe tutamağı ölçeği değiştirir; Shift oranı korur', () => {
    const half = vinylConfig.baseShapeSizeM / 2;
    const corner: [number, number] = [0.5 + half / surface.widthM, 0.5 + half / surface.heightM];
    const far: [number, number] = [0.5 + (2 * half) / surface.widthM, 0.5 + half / surface.heightM];
    const free = dragLayer({ handle: 'scale', layer: l, startUV: corner }, surface, far);
    close(free.scale, [2, 1]);
    const uni = dragLayer({ handle: 'scale', layer: l, startUV: corner }, surface, far, true);
    expect(uni.scale[0]).toBeCloseTo(uni.scale[1]);
  });

  it('döndürme imleç açısını izler; Shift 15° adıma yakalar', () => {
    const right: [number, number] = [0.6, 0.5];
    const up: [number, number] = [0.5, 0.5 + (0.1 * surface.widthM) / surface.heightM];
    const r = dragLayer({ handle: 'rotate', layer: l, startUV: right }, surface, up);
    expect(r.rotationDeg).toBeCloseTo(90);
    const slightly: [number, number] = [0.6, 0.5 + (0.01 * surface.widthM) / surface.heightM];
    const snapped = dragLayer(
      { handle: 'rotate', layer: l, startUV: right },
      surface,
      slightly,
      true,
    );
    expect(snapped.rotationDeg % 15).toBe(0);
  });

  it('eğme tutamağı eğme açısını sınırlar içinde değiştirir', () => {
    const s = dragLayer({ handle: 'skewX', layer: l, startUV: [0.5, 0.6] }, surface, [0.6, 0.6]);
    expect(s.skew[0]).toBeGreaterThan(0);
    expect(s.skew[0]).toBeLessThanOrEqual(vinylConfig.limits.skew.max);
  });
});

describe('vinil kaydı ve geçmiş', () => {
  it('v3 kaydına boş vinil eklenir; vinil JSON gidiş-dönüşünde korunur', () => {
    const base = createDefaultBuild(car.manifest);
    const { vinyl: _v, ...rest } = base;
    const v3 = { ...rest, version: 3 };
    expect(deserializeBuild(JSON.stringify(v3), car.manifest).vinyl).toEqual([]);
    const withLayers = withVinyl(base, [
      createLayer('star', 'top', [0.3, 0.6], { mirrorToOppositeSide: true }),
    ]);
    expect(deserializeBuild(serializeBuild(withLayers), car.manifest)).toEqual(withLayers);
  });

  it('en az 100 adım geri alınabilir; sürükleme önizlemesi tek adım', () => {
    const store = createBuildStore(car.manifest);
    for (let i = 0; i < 120; i++) {
      const s = store.getState();
      s.setVinyl(addLayer(s.build.vinyl, createLayer('circle', 'left', [0.5, 0.5])));
    }
    expect(store.getState().build.vinyl).toHaveLength(120);
    for (let i = 0; i < 100; i++) store.getState().undo();
    expect(store.getState().build.vinyl).toHaveLength(20);

    const before = store.getState().history.past.length;
    const first = store.getState().build.vinyl[0]!;
    for (let k = 0; k < 30; k++)
      store
        .getState()
        .previewVinyl(updateLayer(store.getState().build.vinyl, first.id, { rotationDeg: k }));
    store.getState().commitVinylPreview();
    expect(store.getState().history.past.length).toBe(before + 1);
    expect(store.getState().build.vinyl[0]!.rotationDeg).toBe(29);
  });
});
