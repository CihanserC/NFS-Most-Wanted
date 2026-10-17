import { describe, expect, it } from 'vitest';
import { getCar } from '../../data/cars';
import {
  getVinylShape,
  glyphShapeId,
  hasVinylShape,
  shapeAspect,
  TEXT_SHAPE_ID,
  VINYL_SHAPES,
} from '../../vinyl/shapes/library';
import { GLYPHS, layoutText, normalizeText, STROKE_FONTS } from '../../vinyl/shapes/strokeFont';
import { instantiateSet, VINYL_SETS } from '../../vinyl/sets/presets';
import { textToGlyphLayers } from '../../vinyl/sets/textConvert';
import { composeOps } from './compose';
import { parseVinylGroup, serializeVinylGroup, VinylImportError } from './exchange';
import {
  commonSide,
  duplicateLayers,
  expandToGroups,
  groupLayers,
  moveLayers,
  nudgeLayers,
  removeLayers,
  selectionBounds,
  selectionFor,
  snapPosition,
  transformGroup,
  ungroupLayers,
} from './group';
import { createLayer, sanitizeLayers } from './layers';
import { instancesBySide, layerCornersUV, mirroredLayer } from './projection';
import type { VinylLayer } from './types';

const box = getCar('vanta_stallion_70').vinylBox;
const left = box.surfaces.left;
const ids = (ls: VinylLayer[]) => ls.map((l) => l.id);
const L = (shape = 'circle', pos: [number, number] = [0.5, 0.5], patch: Partial<VinylLayer> = {}) =>
  createLayer(shape, 'left', pos, patch);

describe('şekil kütüphanesi (§7.4)', () => {
  it('spesifikasyondaki tüm şekil grupları var', () => {
    for (const id of [
      'circle',
      'square',
      'rounded_square',
      'triangle',
      'star',
      'line',
      'curved_stripe',
      'gradient_stripe',
      'flame_tongue',
      'lightning',
      'arrow',
      'checker',
    ])
      expect(hasVinylShape(id), id).toBe(true);
    for (const c of '0123456789') expect(getVinylShape(`digit_${c}`)).toBeDefined();
    for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')
      expect(getVinylShape(`letter_${c}`)).toBeDefined();
  });

  it('her harf/rakam şeklinin fontta çizimi var', () => {
    for (const s of VINYL_SHAPES)
      if (s.kind === 'glyph') expect(GLYPHS[s.char], s.id).toBeDefined();
  });

  it('şekil kimlikleri benzersiz', () => {
    expect(new Set(VINYL_SHAPES.map((s) => s.id)).size).toBe(VINYL_SHAPES.length);
  });
});

describe('çizgi fontu ve yazı', () => {
  it('Türkçe büyük harfe çevirir, bilinmeyen karakteri atar', () => {
    expect(normalizeText('istanbul ığdır')).toBe('İSTANBUL IĞDIR');
    expect(normalizeText('a@b€c')).toBe('ABC');
  });

  it('yazı birim kutuya sığar, en-boy oranı uzunlukla artar', () => {
    const short = layoutText('7')!;
    const long = layoutText('7777')!;
    for (const line of long.polylines)
      for (const [x, y] of line) {
        expect(Math.abs(x)).toBeLessThanOrEqual(0.5 + 1e-9);
        expect(Math.abs(y)).toBeLessThanOrEqual(0.5 + 1e-9);
      }
    expect(long.aspect).toBeGreaterThan(short.aspect * 3);
    expect(long.glyphs).toHaveLength(4);
  });

  it('dört font stili farklı çizer (kalınlık / italik)', () => {
    const layouts = STROKE_FONTS.map((f) => layoutText('AB', f.id)!);
    expect(new Set(layouts.map((l) => l.weight.toFixed(3))).size).toBeGreaterThan(2);
    const speed = layoutText('I', 'speed')!;
    const block = layoutText('I', 'block')!;
    expect(speed.aspect).toBeGreaterThan(block.aspect); // italik kayma kutuyu genişletir
  });

  it('boş veya desteklenmeyen yazı çizilmez', () => {
    expect(layoutText('   ')).toBeNull();
    expect(layoutText('€€')).toBeNull();
  });

  it('yazı katmanı doğal oranla, harf şekilleri kendi oranıyla yerleşir', () => {
    expect(shapeAspect(TEXT_SHAPE_ID, '77', 'block')).toBeCloseTo(
      layoutText('77', 'block')!.aspect,
    );
    expect(shapeAspect('letter_I')).toBeLessThan(shapeAspect('letter_M'));
  });

  it('yazıyı şekle dönüştürme: harf başına bir katman, tek grup, aynı yerde', () => {
    const text = createLayer(TEXT_SHAPE_ID, 'left', [0.5, 0.5], {
      text: 'GT 7',
      fontId: 'block',
      scale: [shapeAspect(TEXT_SHAPE_ID, 'GT 7', 'block'), 1],
      color: '#123456',
      rotationDeg: 10,
    });
    const glyphs = textToGlyphLayers(text, left);
    expect(glyphs.map((g) => g.shapeId)).toEqual(['letter_G', 'letter_T', 'digit_7']);
    expect(new Set(glyphs.map((g) => g.groupId)).size).toBe(1);
    expect(glyphs.every((g) => g.color === '#123456' && g.rotationDeg === 10)).toBe(true);
    const cx = glyphs.reduce((a, g) => a + g.position[0], 0) / glyphs.length;
    expect(cx).toBeGreaterThan(0.45);
    expect(cx).toBeLessThan(0.55);
    // Soldan sağa sıralı
    expect(glyphs[0]!.position[0]).toBeLessThan(glyphs[2]!.position[0]);
  });

  it('simetri kopyasında yazı ters dönmez', () => {
    const text = createLayer(TEXT_SHAPE_ID, 'left', [0.3, 0.5], { text: '7', rotationDeg: 20 });
    const m = mirroredLayer(text);
    expect(m.flipX).toBe(false);
    expect(m.side).toBe('right');
    expect(mirroredLayer(L('arrow')).flipX).toBe(true);
    expect(glyphShapeId('7')).toBe('digit_7');
    expect(glyphShapeId('€')).toBeNull();
  });
});

describe('maske / kesme', () => {
  it('değiştirici altındaki en yakın normal katmana uygulanır', () => {
    const a = L('square');
    const m1 = L('circle', [0.5, 0.5], { maskMode: 'mask' });
    const b = L('star');
    const c1 = L('ring', [0.5, 0.5], { maskMode: 'cutout' });
    const c2 = L('circle', [0.5, 0.5], { maskMode: 'cutout' });
    const ops = composeOps(instancesBySide([a, m1, b, c1, c2]).left);
    expect(ops).toHaveLength(2);
    expect(ops[0]!.target.source).toBe(a);
    expect(ops[0]!.modifiers.map((m) => m.source)).toEqual([m1]);
    expect(ops[1]!.modifiers.map((m) => m.source)).toEqual([c1, c2]);
  });

  it('altında hedef olmayan değiştirici yok sayılır', () => {
    expect(
      composeOps(instancesBySide([L('circle', [0.5, 0.5], { maskMode: 'mask' })]).left),
    ).toEqual([]);
  });
});

describe('gruplar ve çoklu seçim', () => {
  const a = L('circle', [0.2, 0.5]);
  const b = L('square', [0.4, 0.5]);
  const c = L('star', [0.6, 0.5]);
  const d = L('triangle', [0.8, 0.5]);

  it('gruplama üyeleri en üstteki üyenin yerinde bitişik toplar', () => {
    const { layers, groupId } = groupLayers([a, b, c, d], [a.id, c.id]);
    expect(groupId).not.toBeNull();
    expect(ids(layers)).toEqual([b.id, a.id, c.id, d.id]);
    expect(layers.filter((l) => l.groupId === groupId)).toHaveLength(2);
  });

  it('tek katman gruplanmaz; çözme grup kimliğini kaldırır', () => {
    expect(groupLayers([a, b], [a.id]).groupId).toBeNull();
    const { layers } = groupLayers([a, b, c], [a.id, b.id]);
    expect(ungroupLayers(layers, [a.id]).every((l) => !l.groupId)).toBe(true);
  });

  it('grup üyesine tıklamak tüm grubu seçer (Alt: tek üye)', () => {
    const { layers } = groupLayers([a, b, c], [a.id, b.id]);
    expect(selectionFor(layers, a.id).sort()).toEqual([a.id, b.id].sort());
    expect(selectionFor(layers, a.id, true)).toEqual([a.id]);
    expect(selectionFor(layers, c.id)).toEqual([c.id]);
    expect(expandToGroups(layers, [b.id]).sort()).toEqual([a.id, b.id].sort());
  });

  it('çoğaltılan grup yeni grup kimliği alır', () => {
    const { layers } = groupLayers([a, b, c], [a.id, b.id]);
    const r = duplicateLayers(layers, [a.id, b.id]);
    expect(r.copyIds).toHaveLength(2);
    const copies = r.layers.filter((l) => r.copyIds.includes(l.id));
    expect(copies[0]!.groupId).toBe(copies[1]!.groupId);
    expect(copies[0]!.groupId).not.toBe(layers[0]!.groupId);
  });

  it('blok sıralama: grup tek parça gibi hareket eder', () => {
    const { layers } = groupLayers([a, b, c, d], [b.id, c.id]);
    expect(ids(moveLayers(layers, [b.id, c.id], 'up'))).toEqual([a.id, d.id, b.id, c.id]);
    expect(ids(moveLayers(layers, [b.id, c.id], 'down'))).toEqual([b.id, c.id, a.id, d.id]);
    // a'yı yukarı taşımak b+c grubunun tamamının üstüne çıkarır
    expect(ids(moveLayers(layers, [a.id], 'up'))).toEqual([b.id, c.id, a.id, d.id]);
    expect(ids(removeLayers(layers, [b.id, c.id]))).toEqual([a.id, d.id]);
  });

  it('ortak yüz: farklı yüzlerde grup dönüşümü yok', () => {
    const r = createLayer('circle', 'right', [0.5, 0.5]);
    expect(commonSide([a, b], [a.id, b.id])).toBe('left');
    expect(commonSide([a, r], [a.id, r.id])).toBeNull();
  });

  it('grup taşıma / döndürme / eşit ölçek', () => {
    const ls = [a, b];
    const set = [a.id, b.id];
    const moved = transformGroup(ls, set, left, 'move', [0.3, 0.5], [0.35, 0.6]);
    expect(moved[0]!.position[0]).toBeCloseTo(0.25);
    expect(moved[1]!.position[1]).toBeCloseTo(0.6);

    const bounds = selectionBounds(ls, set, left)!;
    const cu = (bounds[0] + bounds[2]) / 2;
    const cv = (bounds[1] + bounds[3]) / 2;
    const rot = transformGroup(
      ls,
      set,
      left,
      'rotate',
      [cu + 0.1, cv],
      [cu, cv + (0.1 * left.widthM) / left.heightM],
    );
    expect(rot[0]!.rotationDeg).toBeCloseTo(90);
    // Merkeze uzaklık korunur
    const dist = (l: VinylLayer) =>
      Math.hypot((l.position[0] - cu) * left.widthM, (l.position[1] - cv) * left.heightM);
    expect(dist(rot[0]!)).toBeCloseTo(dist(a));

    const scaled = transformGroup(ls, set, left, 'scale', [cu + 0.1, cv], [cu + 0.2, cv]);
    expect(scaled[0]!.scale[0]).toBeCloseTo(a.scale[0] * 2);
    expect(dist(scaled[1]!)).toBeCloseTo(dist(b) * 2);
  });

  it('döndürmede açı yakalama', () => {
    const r = transformGroup([a, b], [a.id, b.id], left, 'rotate', [0.6, 0.5], [0.6, 0.53], 15);
    expect(r[0]!.rotationDeg % 15).toBeCloseTo(0);
  });

  it('kaydırma kilitli katmanı oynatmaz; mıknatıs orta çizgiye yakalar', () => {
    const locked = L('circle', [0.5, 0.5], { locked: true });
    const out = nudgeLayers([a, locked], [a.id, locked.id], 0.01, 0);
    expect(out[0]!.position[0]).toBeCloseTo(0.21);
    expect(out[1]).toBe(locked);
    expect(snapPosition([0.505, 0.333], 0.01, 0.012)).toEqual([0.5, 0.33]);
    expect(snapPosition([0.3149, 0.2], 0.01, 0.012)).toEqual([0.31, 0.2]);
  });
});

describe('vinil grubu dışa / içe aktarma', () => {
  it('gidiş-dönüş: içerik korunur, kimlikler yenilenir, tek grup gelir', () => {
    const src = [L('star', [0.3, 0.4], { color: '#ff0000', maskMode: 'cutout' }), L('circle')];
    const back = parseVinylGroup(serializeVinylGroup(src), hasVinylShape);
    expect(back).toHaveLength(2);
    expect(back[0]!.id).not.toBe(src[0]!.id);
    expect(back[0]!.color).toBe('#ff0000');
    expect(back[0]!.maskMode).toBe('cutout');
    expect(back[0]!.groupId).toBeDefined();
    expect(back[0]!.groupId).toBe(back[1]!.groupId);
  });

  it('yazı katmanı metniyle aktarılır', () => {
    const text = createLayer(TEXT_SHAPE_ID, 'top', [0.5, 0.5], { text: 'MUSCLE', fontId: 'speed' });
    const [back] = parseVinylGroup(serializeVinylGroup([text]), hasVinylShape);
    expect(back!.text).toBe('MUSCLE');
    expect(back!.fontId).toBe('speed');
  });

  it('bozuk / yabancı dosyayı anlaşılır hatayla reddeder', () => {
    expect(() => parseVinylGroup('{', hasVinylShape)).toThrow(VinylImportError);
    expect(() => parseVinylGroup('{"format":"x"}', hasVinylShape)).toThrow(/Tanınmayan/);
    expect(() =>
      parseVinylGroup(
        JSON.stringify({ format: 'muscle-garage/vinyl', version: 9, layers: [] }),
        hasVinylShape,
      ),
    ).toThrow(/sürüm/);
    expect(() =>
      parseVinylGroup(
        JSON.stringify({ format: 'muscle-garage/vinyl', version: 1, layers: [{ shapeId: 'yok' }] }),
        hasVinylShape,
      ),
    ).toThrow(/geçerli katman/);
  });
});

describe('hazır setler', () => {
  it('6 set var; tüm katmanlar geçerli şekil kullanır', () => {
    expect(VINYL_SETS.map((s) => s.id)).toEqual([
      'rally_stripes',
      'bumblebee',
      'side_c_stripe',
      'flames',
      'race_number',
      'checkered_flag',
    ]);
    for (const set of VINYL_SETS) {
      const layers = instantiateSet(set);
      expect(sanitizeLayers(layers, hasVinylShape), set.id).toHaveLength(layers.length);
    }
  });

  it('her yüz ayrı grup olur; kimlikler her eklemede yeni', () => {
    const rally = VINYL_SETS.find((s) => s.id === 'rally_stripes')!;
    const a = instantiateSet(rally);
    const b = instantiateSet(rally);
    expect(new Set(a.map((l) => l.groupId)).size).toBe(new Set(a.map((l) => l.side)).size);
    expect(a[0]!.id).not.toBe(b[0]!.id);
  });

  it('yarış numarası yazısı doğal oranla gelir ve panele sığar', () => {
    const race = instantiateSet(VINYL_SETS.find((s) => s.id === 'race_number')!);
    const [panel, num] = race;
    expect(num!.scale[0]).toBeGreaterThan(num!.scale[1]);
    const pc = layerCornersUV(panel!, left);
    const nc = layerCornersUV(num!, left);
    const width = (cs: [number, number][]) =>
      Math.max(...cs.map((c) => c[0])) - Math.min(...cs.map((c) => c[0]));
    expect(width(nc)).toBeLessThan(width(pc));
  });

  it('setler projeksiyon yüzeyinin içinde', () => {
    for (const set of VINYL_SETS)
      for (const l of instantiateSet(set)) {
        expect(l.position[0], `${set.id}`).toBeGreaterThan(0);
        expect(l.position[0], `${set.id}`).toBeLessThan(1);
        expect(l.position[1], `${set.id}`).toBeGreaterThan(0);
        expect(l.position[1], `${set.id}`).toBeLessThan(1);
      }
  });
});

describe('vinil çevirileri', () => {
  it('tüm şekil, kategori, set, font ve maske adlarının Türkçesi var', async () => {
    const { hasTranslation } = await import('../../i18n');
    const { SHAPE_CATEGORIES } = await import('../../vinyl/shapes/library');
    const keys = [
      ...VINYL_SHAPES.map((s) => `vinylShape.${s.id}`),
      ...SHAPE_CATEGORIES.map((c) => `shapeCategory.${c}`),
      ...VINYL_SETS.map((s) => `vinylSet.${s.id}`),
      ...STROKE_FONTS.map((f) => `font.${f.id}`),
      ...['none', 'mask', 'cutout'].flatMap((m) => [`maskMode.${m}`, `maskHint.${m}`]),
    ];
    expect(keys.filter((k) => !hasTranslation(k))).toEqual([]);
  });
});
