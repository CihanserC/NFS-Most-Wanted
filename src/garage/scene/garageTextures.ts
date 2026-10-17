import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { blotches, heightToNormal, makeCanvas, seededRandom } from '../../core/texture/canvas';

/** Atölye ortamı için prosedürel dokular (bir kez üretilir, sahne boyunca paylaşılır). */

const SIZE = { concrete: 512, brick: 512, metal: 256, blob: 256, disc: 512 };
const SEED = { concrete: 7, brick: 11 };

const cache = new Map<string, Texture>();
const once = <T extends Texture>(key: string, make: () => T): T => {
  const hit = cache.get(key);
  if (hit) return hit as T;
  const t = make();
  cache.set(key, t);
  return t;
};

function tiled(c: HTMLCanvasElement, repeat: [number, number], srgb: boolean): CanvasTexture {
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
}

/** Beton: renk (lekeler, yağ izleri, derz çizgileri) + pürüzlülük haritası. */
export function concreteTextures(repeat: number): { map: Texture; roughnessMap: Texture } {
  return {
    map: once(`concrete-map-${repeat}`, () => {
      const s = SIZE.concrete;
      const [c, ctx] = makeCanvas(s);
      const rand = seededRandom(SEED.concrete);
      ctx.fillStyle = '#8d8f93';
      ctx.fillRect(0, 0, s, s);
      blotches(ctx, s, rand, 90, (a) => `rgba(40,40,44,${a})`, s * 0.18);
      blotches(ctx, s, rand, 60, (a) => `rgba(190,190,195,${a})`, s * 0.12);
      blotches(ctx, s, rand, 10, (a) => `rgba(10,8,6,${a * 1.2})`, s * 0.06);
      // İnce kum dokusu
      const img = ctx.getImageData(0, 0, s, s);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (rand() - 0.5) * 18;
        img.data[i] = (img.data[i] ?? 0) + n;
        img.data[i + 1] = (img.data[i + 1] ?? 0) + n;
        img.data[i + 2] = (img.data[i + 2] ?? 0) + n;
      }
      ctx.putImageData(img, 0, 0);
      // Derz (dilatasyon) çizgileri: karo kenarında
      ctx.fillStyle = 'rgba(20,20,22,0.55)';
      ctx.fillRect(0, 0, s, 2);
      ctx.fillRect(0, 0, 2, s);
      return tiled(c, [repeat, repeat], true);
    }),
    roughnessMap: once(`concrete-rough-${repeat}`, () => {
      const s = SIZE.concrete;
      const [c, ctx] = makeCanvas(s);
      const rand = seededRandom(SEED.concrete + 1);
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(0, 0, s, s);
      // Koyu = pürüzsüz: cilalı/ıslak görünen alanlar yansımaya katkı verir.
      blotches(ctx, s, rand, 40, (a) => `rgba(0,0,0,${a * 1.2})`, s * 0.22);
      blotches(ctx, s, rand, 30, (a) => `rgba(255,255,255,${a})`, s * 0.1);
      return tiled(c, [repeat, repeat], false);
    }),
  };
}

/** Tuğla duvar: renk + normal haritası (koşu bağı). */
export function brickTextures(repeat: [number, number]): { map: Texture; normalMap: Texture } {
  const rows = 16;
  const cols = 8;
  const draw = (ctx: CanvasRenderingContext2D, s: number, colorMode: boolean) => {
    const rand = seededRandom(SEED.brick);
    const bh = s / rows;
    const bw = s / cols;
    const mortar = 4;
    ctx.fillStyle = colorMode ? '#2a2420' : '#000';
    ctx.fillRect(0, 0, s, s);
    for (let r = 0; r < rows; r++)
      for (let k = -1; k < cols; k++) {
        const x = k * bw + (r % 2 ? bw / 2 : 0);
        const shade = 0.75 + rand() * 0.35;
        ctx.fillStyle = colorMode
          ? `rgb(${Math.round(112 * shade)},${Math.round(58 * shade)},${Math.round(44 * shade)})`
          : `rgb(${Math.round(200 + rand() * 55)},0,0)`;
        ctx.fillRect(x + mortar / 2, r * bh + mortar / 2, bw - mortar, bh - mortar);
      }
    if (colorMode) blotches(ctx, s, rand, 40, (a) => `rgba(0,0,0,${a * 2})`, s * 0.2);
  };
  return {
    map: once(`brick-map-${repeat.join('x')}`, () => {
      const [c, ctx] = makeCanvas(SIZE.brick);
      draw(ctx, SIZE.brick, true);
      return tiled(c, repeat, true);
    }),
    normalMap: once(`brick-normal-${repeat.join('x')}`, () => {
      const [c, ctx] = makeCanvas(SIZE.brick);
      draw(ctx, SIZE.brick, false);
      heightToNormal(ctx, SIZE.brick, SIZE.brick, 4);
      return tiled(c, repeat, false);
    }),
  };
}

/** Oluklu sac: dikey dalga normal haritası. */
export function corrugatedNormal(repeat: [number, number]): Texture {
  return once(`metal-normal-${repeat.join('x')}`, () => {
    const s = SIZE.metal;
    const [c, ctx] = makeCanvas(s);
    const waves = 8;
    for (let x = 0; x < s; x++) {
      const v = 0.5 + 0.5 * Math.sin((x / s) * waves * Math.PI * 2);
      ctx.fillStyle = `rgb(${Math.round(v * 255)},0,0)`;
      ctx.fillRect(x, 0, 1, s);
    }
    heightToNormal(ctx, s, s, 3);
    return tiled(c, repeat, false);
  });
}

/** Araç altı gölgesi: kenarları yumuşak yuvarlatılmış dikdörtgen (alfa). */
export function shadowBlob(): Texture {
  return once('shadow-blob', () => {
    const s = SIZE.blob;
    const [c, ctx] = makeCanvas(s);
    ctx.filter = `blur(${s * 0.08}px)`;
    ctx.fillStyle = '#fff';
    const inset = s * 0.2;
    ctx.beginPath();
    ctx.roundRect(inset, inset, s - inset * 2, s - inset * 2, s * 0.15);
    ctx.fill();
    return new CanvasTexture(c);
  });
}

/** Döner tabla diski: radyal birleşim çizgileri ve merkez plakası (alfa). */
export function turntableDisc(seams: number): Texture {
  return once(`turntable-${seams}`, () => {
    const s = SIZE.disc;
    const [c, ctx] = makeCanvas(s);
    const r = s / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(r, r, r - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 3;
    for (let i = 0; i < seams; i++) {
      const a = (i / seams) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(r + Math.cos(a) * r * 0.18, r + Math.sin(a) * r * 0.18);
      ctx.lineTo(r + Math.cos(a) * r, r + Math.sin(a) * r);
      ctx.stroke();
    }
    for (const rr of [0.18, 0.62]) {
      ctx.beginPath();
      ctx.arc(r, r, r * rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    return new CanvasTexture(c);
  });
}
