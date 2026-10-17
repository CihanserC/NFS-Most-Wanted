import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import type { RotorType, TireSidewall, TireType } from '../../../core/wheels/types';

/**
 * Tarayıcıda canvas ile üretilen jant/lastik/fren dokuları. Her varyant bir kez
 * üretilir (modül önbelleği); varyant sayısı az olduğu için atılmaz.
 */

/** Kurgusal lastik markası (gerçek marka kullanılmaz). */
export const TIRE_BRAND = 'IRONHOOF  RADIAL  T/A';

const TEXTURE = {
  tread: { size: 256, repeatAround: 44, strength: 3 },
  sidewall: { width: 2048, height: 128, base: '#141416', white: '#ece8dc' },
  rotor: { size: 256 },
};

const cache = new Map<string, Texture>();
const cached = (key: string, make: () => Texture): Texture => {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
};

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D bağlamı alınamadı');
  return [c, ctx];
}

/** Gri yükseklik haritasını tangent-uzayı normal haritasına çevirir. */
function heightToNormal(ctx: CanvasRenderingContext2D, size: number, strength: number) {
  const src = ctx.getImageData(0, 0, size, size).data;
  const out = ctx.createImageData(size, size);
  const h = (x: number, y: number) =>
    (src[(((y + size) % size) * size + ((x + size) % size)) * 4] ?? 0) / 255;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (h(x - 1, y) - h(x + 1, y)) * strength;
      const dy = (h(x, y - 1) - h(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      out.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  ctx.putImageData(out, 0, 0);
}

/** Diş deseni normal haritası. u = çevre, v = sırt genişliği. */
export function treadNormalMap(type: TireType): Texture {
  return cached(`tread:${type}`, () => {
    const { size, repeatAround, strength } = TEXTURE.tread;
    const [c, ctx] = canvas(size, size);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    // Çevresel oluklar (u boyunca uzanır -> canvas yatay çizgileri v'de)
    const grooves =
      type === 'street' ? [0.28, 0.5, 0.72] : type === 'semi_slick' ? [0.35, 0.65] : [0.5];
    const grooveW = type === 'drag_radial' ? 0.025 : 0.05;
    for (const g of grooves) ctx.fillRect(0, (g - grooveW / 2) * size, size, grooveW * size);
    if (type === 'street') {
      // Enine kesikler (blok desen)
      ctx.lineWidth = size * 0.05;
      ctx.strokeStyle = '#000';
      for (let i = 0; i < 2; i++) {
        const x = (i + 0.25) * (size / 2);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + size * 0.12, size * 0.28);
        ctx.moveTo(x + size * 0.2, size * 0.5);
        ctx.lineTo(x + size * 0.08, size * 0.72);
        ctx.moveTo(x + size * 0.12, size * 0.72);
        ctx.lineTo(x, size);
        ctx.stroke();
      }
    } else if (type === 'drag_radial') {
      ctx.lineWidth = size * 0.015;
      for (let i = 0; i < 4; i++) {
        const x = (i + 0.5) * (size / 4);
        ctx.beginPath();
        ctx.moveTo(x, size * 0.1);
        ctx.lineTo(x + size * 0.05, size * 0.3);
        ctx.moveTo(x, size * 0.7);
        ctx.lineTo(x + size * 0.05, size * 0.9);
        ctx.stroke();
      }
    }
    heightToNormal(ctx, size, strength);
    const t = new CanvasTexture(c);
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.repeat.set(repeatAround, 1);
    return t;
  });
}

/**
 * Dış yanak dokusu. Lathe UV'sinde u = çevre, v = omuz (0) -> topuk (1).
 * Canvas'ta üst satır v=1 (topuk), alt satır v=0 (omuz).
 */
export function sidewallMap(style: TireSidewall): Texture {
  return cached(`sidewall:${style}`, () => {
    const { width, height, base, white } = TEXTURE.sidewall;
    const [c, ctx] = canvas(width, height);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);
    if (style === 'whitewall') {
      ctx.fillStyle = white;
      ctx.fillRect(0, height * 0.3, width, height * 0.32);
    } else if (style === 'raised_white_letters') {
      ctx.fillStyle = white;
      ctx.font = `bold ${Math.round(height * 0.3)}px Impact, 'Arial Black', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Harflerin "yukarısı" omuza (dışa) baksın: canvas'ta aşağı -> 180° çevir.
      for (const at of [0.25, 0.75]) {
        ctx.save();
        ctx.translate(width * at, height * 0.55);
        ctx.rotate(Math.PI);
        ctx.fillText(TIRE_BRAND, 0, 0);
        ctx.restore();
      }
    }
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.wrapS = RepeatWrapping;
    t.anisotropy = 4;
    return t;
  });
}

/** Disk yüzeyi: silindir kapak UV'si düzlemsel (merkez 0.5, 0.5). */
export function rotorMap(rotor: RotorType): Texture {
  return cached(`rotor:${rotor}`, () => {
    const { size } = TEXTURE.rotor;
    const [c, ctx] = canvas(size, size);
    const cx = size / 2;
    ctx.fillStyle = '#8c8f94';
    ctx.fillRect(0, 0, size, size);
    // İşleme izleri
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let r = size * 0.28; r < size * 0.5; r += 3) {
      ctx.beginPath();
      ctx.arc(cx, cx, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#1b1c1f';
    ctx.strokeStyle = '#1b1c1f';
    if (rotor === 'drilled') {
      for (let ring = 0; ring < 3; ring++)
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2 + ring * 0.09;
          const r = size * (0.33 + ring * 0.05);
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * r, cx + Math.sin(a) * r, size * 0.008, 0, Math.PI * 2);
          ctx.fill();
        }
    } else if (rotor === 'slotted') {
      ctx.lineWidth = size * 0.008;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cx, size * 0.4, a, a + 0.35);
        ctx.stroke();
      }
    }
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  });
}
