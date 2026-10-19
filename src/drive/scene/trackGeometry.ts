import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import type { Track, TrackSample } from '../../core/drive/track';

/** Asfalt dokusunun pist boyunca tekrarlandığı uzunluk (m) */
export const ASPHALT_TILE_M = 12;
export const KERB_TILE_M = 3;
export const GRASS_TILE_M = 10;
/** Yüzey yükseklikleri: z-fighting olmasın diye asfalt > çim, kerb > asfalt */
export const SURFACE_Y = {
  grass: 0,
  verge: 0.005,
  asphalt: 0.01,
  kerb: 0.02,
  line: 0.015,
} as const;
export const VERGE_TILE_M = 8;

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

/** Asfalt: ince agrega, hafif büyük ölçekli ton farkı, beyaz kenar çizgileri ve kauçuk izi (yanal u: 0..1). */
export function createAsphaltTexture(): CanvasTexture {
  const W = 512;
  const H = 1024;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#2b2c2f';
  ctx.fillRect(0, 0, W, H);
  // Büyük ölçekli ton farkı (yama/onarım hissi), çok düşük kontrast
  for (let i = 0; i < 40; i++) {
    const v = 30 + Math.floor(Math.random() * 18);
    ctx.fillStyle = `rgba(${v},${v},${v + 2},0.18)`;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * W,
      Math.random() * H,
      30 + Math.random() * 90,
      40 + Math.random() * 160,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  // İnce agrega: tek piksellik, düşük kontrastlı taneler
  for (let i = 0; i < 60000; i++) {
    const v = 20 + Math.floor(Math.random() * 70);
    ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }
  // Yarış çizgisi kauçuk izi: iki koyu, yumuşak bant
  for (const center of [0.36, 0.64]) {
    const g = ctx.createLinearGradient(W * (center - 0.12), 0, W * (center + 0.12), 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(W * (center - 0.12), 0, W * 0.24, H);
  }
  // Kenar çizgileri (pist kenarından biraz içeride)
  ctx.fillStyle = '#e4e2da';
  ctx.fillRect(W * 0.025, 0, 8, H);
  ctx.fillRect(W * 0.975 - 8, 0, 8, H);
  return finish(c);
}

/** Başlangıç/bitiş çizgisi: iki sıra dama (u: pist enine, v: boyuna). */
export function createCheckerTexture(columns = 16): CanvasTexture {
  const cell = 32;
  const [c, ctx] = canvas(columns * cell, cell * 2);
  for (let x = 0; x < columns; x++)
    for (let y = 0; y < 2; y++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#f2f0ea' : '#151517';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  const t = finish(c);
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  return t;
}

/** Bariyere kadar uzanan biçilmiş çim: pist boyunca açık/koyu biçme şeritleri. */
export function createVergeTexture(): CanvasTexture {
  const [c, ctx] = canvas(64, 256);
  ctx.fillStyle = '#4a5a2a';
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = '#3f4f24';
  ctx.fillRect(0, 128, 64, 128);
  for (let i = 0; i < 900; i++) {
    const hue = 72 + Math.random() * 20;
    ctx.fillStyle = `hsla(${hue}, 32%, ${20 + Math.random() * 12}%, 0.45)`;
    ctx.fillRect(
      Math.random() * 64,
      Math.random() * 256,
      1 + Math.random() * 2,
      1 + Math.random() * 3,
    );
  }
  return finish(c);
}

/** Başlangıç kapısı afişi: koyu zemin, turuncu şerit ve pist adı. */
export function createGantryBannerTexture(title: string): CanvasTexture {
  const [c, ctx] = canvas(1024, 128);
  ctx.fillStyle = '#121316';
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = '#ff7a18';
  ctx.fillRect(0, 0, 1024, 10);
  ctx.fillRect(0, 118, 1024, 10);
  ctx.fillStyle = '#f2efe8';
  ctx.font = 'bold 62px "Bahnschrift", "Arial Narrow", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 512, 66);
  const t = finish(c);
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  return t;
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

/**
 * Bariyer duvarı: kapalı zincir noktalarından tek parça prizma (iç yüz, dış yüz, üst). Eklemde
 * iki komşu segment aynı (açıortay yönünde ofsetlenmiş) köşeleri paylaşır; böylece segmentler
 * örtüşmez ve renk sınırında yüzler üst üste binip titremez. Renkler segment başına (vertexColors).
 */
export function barrierWallGeometry(
  points: readonly (readonly [number, number])[],
  thickness: number,
  height: number,
  colors: readonly (readonly number[])[],
): BufferGeometry {
  const n = points.length;
  // Eklem normali: komşu iki segment yönünün ortalamasına dik (yatay)
  const normals = points.map((_, i) => {
    const [px, pz] = points[(i - 1 + n) % n] as readonly [number, number];
    const [nx, nz] = points[(i + 1) % n] as readonly [number, number];
    const dx = nx - px;
    const dz = nz - pz;
    const len = Math.hypot(dx, dz) || 1;
    return [-dz / len, dx / len] as const;
  });
  const half = thickness / 2;
  const corner = (i: number, side: 1 | -1, y: number) => {
    const [x, z] = points[i % n] as readonly [number, number];
    const [ox, oz] = normals[i % n] as readonly [number, number];
    return [x + ox * half * side, y, z + oz * half * side];
  };
  const pos: number[] = [];
  const col: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], rgb: readonly number[]) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let k = 0; k < 6; k++) col.push(...rgb);
  };
  for (let i = 0; i < n; i++) {
    const j = i + 1;
    const rgb = colors[i % colors.length] as readonly number[];
    // İki yan yüz ve üst yüz (alt yüz zeminde, görünmez)
    quad(corner(i, 1, 0), corner(j, 1, 0), corner(j, 1, height), corner(i, 1, height), rgb);
    quad(corner(j, -1, 0), corner(i, -1, 0), corner(i, -1, height), corner(j, -1, height), rgb);
    quad(
      corner(i, 1, height),
      corner(j, 1, height),
      corner(j, -1, height),
      corner(i, -1, height),
      rgb,
    );
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
