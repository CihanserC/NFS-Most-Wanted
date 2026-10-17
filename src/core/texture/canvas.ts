/** Tarayıcıda canvas ile prosedürel doku üretimi için ortak yardımcılar. */

export function makeCanvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D bağlamı alınamadı');
  return [c, ctx];
}

/** Gri yükseklik haritasını (R kanalı) yerinde tangent-uzayı normal haritasına çevirir. */
export function heightToNormal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
): void {
  const src = ctx.getImageData(0, 0, width, height).data;
  const out = ctx.createImageData(width, height);
  const h = (x: number, y: number) =>
    (src[(((y + height) % height) * width + ((x + width) % width)) * 4] ?? 0) / 255;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const dx = (h(x - 1, y) - h(x + 1, y)) * strength;
      const dy = (h(x, y - 1) - h(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * width + x) * 4;
      out.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  ctx.putImageData(out, 0, 0);
}

/** Tekrarlanabilir rastgele sayı üreteci (mulberry32); dokular her açılışta aynı olsun. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Yumuşak lekeler: farklı boyutlarda yarı saydam dairelerle düşük frekanslı gürültü. */
export function blotches(
  ctx: CanvasRenderingContext2D,
  size: number,
  rand: () => number,
  count: number,
  color: (alpha: number) => string,
  maxRadius: number,
): void {
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = (0.2 + rand() * 0.8) * maxRadius;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color(0.06 + rand() * 0.1));
    g.addColorStop(1, color(0));
    ctx.fillStyle = g;
    // Kenarlarda dikiş olmasın diye dört yana sarar.
    for (const ox of [-size, 0, size])
      for (const oy of [-size, 0, size]) {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.restore();
      }
  }
}
