import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import type { Track, TrackSample } from '../../core/drive/track';

/** Asfalt dokusunun pist boyunca tekrarlandığı uzunluk (m) */
export const ASPHALT_TILE_M = 12;
export const KERB_TILE_M = 3;
export const GRASS_TILE_M = 10;
/** Yüzey yükseklikleri: z-fighting olmasın diye asfalt > çim, kerb > asfalt */
export const SURFACE_Y = { grass: 0, asphalt: 0.01, kerb: 0.02 } as const;

/**
 * Pist boyunca [fromOffset, toOffset] arası (sol pozitif) şerit. UV: u = yanal 0..1,
 * v = yay uzunluğu / tileM.
 */
export function ribbonGeometry(
  track: Track,
  fromOffset: number,
  toOffset: number,
  y: number,
  tileM: number,
): BufferGeometry {
  const n = track.samples.length;
  const count = n + 1; // kapanış için ilk örnek tekrar
  const positions = new Float32Array(count * 2 * 3);
  const normals = new Float32Array(count * 2 * 3);
  const uvs = new Float32Array(count * 2 * 2);
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    const s = track.samples[i % n] as TrackSample;
    const along = i === n ? track.length : s.s;
    const edges = [fromOffset, toOffset];
    for (let k = 0; k < 2; k++) {
      const o = edges[k] as number;
      const vi = i * 2 + k;
      positions.set([s.x + s.nx * o, y, s.z + s.nz * o], vi * 3);
      normals.set([0, 1, 0], vi * 3);
      uvs.set([k, along / tileM], vi * 2);
    }
    if (i < n) {
      const a = i * 2;
      // Yukarıdan bakınca saat yönü tersi (normal +y)
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  g.setAttribute('uv', new BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas bağlamı alınamadı');
  return [c, ctx];
}

const noise = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  count: number,
  alpha: number,
) => {
  for (let i = 0; i < count; i++) {
    const v = Math.floor(Math.random() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(
      Math.random() * w,
      Math.random() * h,
      1 + Math.random() * 2,
      1 + Math.random() * 2,
    );
  }
};

function finish(c: HTMLCanvasElement, repeatX = 1, repeatY = 1): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  t.generateMipmaps = true;
  return t;
}

/** Asfalt: gürültü, kenar çizgileri ve kesik orta şerit (yanal u: 0..1). */
export function createAsphaltTexture(): CanvasTexture {
  const [c, ctx] = canvas(256, 512);
  ctx.fillStyle = '#2a2b2e';
  ctx.fillRect(0, 0, 256, 512);
  noise(ctx, 256, 512, 9000, 0.12);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  // araç iz bantları (hafif koyu)
  ctx.fillRect(256 * 0.28, 0, 22, 512);
  ctx.fillRect(256 * 0.68, 0, 22, 512);
  ctx.fillStyle = '#d8d8d0';
  ctx.fillRect(256 * 0.03, 0, 6, 512);
  ctx.fillRect(256 * 0.97 - 6, 0, 6, 512);
  ctx.fillStyle = '#c9b24a';
  ctx.fillRect(256 * 0.5 - 3, 0, 6, 150);
  return finish(c);
}

export function createKerbTexture(): CanvasTexture {
  const [c, ctx] = canvas(64, 128);
  ctx.fillStyle = '#d0302a';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ecebe6';
  ctx.fillRect(0, 64, 64, 64);
  noise(ctx, 64, 128, 300, 0.1);
  return finish(c);
}

export function createGrassTexture(): CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#3d4a24';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const hue = 70 + Math.random() * 25;
    ctx.fillStyle = `hsla(${hue}, 35%, ${18 + Math.random() * 14}%, 0.55)`;
    ctx.fillRect(
      Math.random() * 256,
      Math.random() * 256,
      2 + Math.random() * 4,
      2 + Math.random() * 4,
    );
  }
  // kuru, tozlu lekeler
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(150,120,70,${0.05 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 18, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c);
}
