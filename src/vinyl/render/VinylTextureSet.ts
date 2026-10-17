import { CanvasTexture, NoColorSpace } from 'three';
import { hexToRgb } from '../../core/color/color';
import { composeOps } from '../../core/vinyl/compose';
import {
  applyAffine,
  canvasTransform,
  instancesBySide,
  layerTransform,
  vinylConfig,
  type LayerInstance,
  type ProjectionBox,
  type ProjectionSurface,
} from '../../core/vinyl/projection';
import { VINYL_SIDES, type VinylLayer, type VinylSide } from '../../core/vinyl/types';
import { getVinylShape, TEXT_SHAPE_ID } from '../shapes/library';
import { layoutText, type TextLayout } from '../shapes/strokeFont';

const ANISOTROPY = 8;

type Ctx = CanvasRenderingContext2D;

/**
 * Beş projeksiyon yüzeyinin canvas'ları ve dokuları. Katmanlar değişince sadece içeriği
 * değişen yüzeyler yeniden çizilir; birden fazla değişiklik tek animasyon karesinde
 * birleştirilir. Maske/kesme katmanları ara bir canvas üzerinde hedefe uygulanır.
 */
export class VinylTextureSet {
  readonly textures: Record<VinylSide, CanvasTexture>;
  private readonly contexts: Record<VinylSide, Ctx>;
  private readonly scratch: Partial<Record<VinylSide, Ctx>> = {};
  private readonly last: Record<VinylSide, LayerInstance[]>;
  private pending: Record<VinylSide, LayerInstance[]> | null = null;
  private frame = 0;
  private readonly paths = new Map<string, Path2D>();
  private readonly layouts = new Map<string, TextLayout | null>();
  /** Son yeniden çizimde çizilen yüzeyler (performans testi / hata ayıklama) */
  lastRedrawn: VinylSide[] = [];

  constructor(private readonly box: ProjectionBox) {
    const contexts = {} as Record<VinylSide, Ctx>;
    const textures = {} as Record<VinylSide, CanvasTexture>;
    const last = {} as Record<VinylSide, LayerInstance[]>;
    for (const side of VINYL_SIDES) {
      const ctx = createContext(...vinylConfig.resolution[side]);
      const tex = new CanvasTexture(ctx.canvas);
      // Renk uzayı dönüşümü shader'da yapılır: sRGB işaretli canvas dokusunun her karede
      // yüklenmesi three/ANGLE'da ~70 ms sürüyordu (ham yükleme ~0.1 ms).
      tex.colorSpace = NoColorSpace;
      // Saydam kenarlarda koyu hale olmasın diye önceden çarpılmış alfa.
      tex.premultiplyAlpha = true;
      tex.anisotropy = ANISOTROPY;
      contexts[side] = ctx;
      textures[side] = tex;
      last[side] = [];
    }
    this.contexts = contexts;
    this.textures = textures;
    this.last = last;
  }

  /** Yeni katman listesini işler; değişen yüzeyleri bir sonraki karede çizer. */
  update(layers: VinylLayer[]): void {
    this.pending = instancesBySide(layers);
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.flush();
    });
  }

  /** Bekleyen çizimi hemen uygular. */
  flush(): void {
    const next = this.pending;
    if (!next) return;
    this.pending = null;
    this.lastRedrawn = [];
    for (const side of VINYL_SIDES) {
      if (sameInstances(this.last[side], next[side])) continue;
      this.draw(side, next[side]);
      this.last[side] = next[side];
      this.lastRedrawn.push(side);
    }
  }

  /** Bir yüzeyin canvas'ı (fotoğraf/önizleme için salt okunur kullanım). */
  canvas(side: VinylSide): HTMLCanvasElement {
    return this.contexts[side].canvas;
  }

  private draw(side: VinylSide, instances: LayerInstance[]): void {
    const ctx = this.contexts[side];
    const { width, height } = ctx.canvas;
    const surface = this.box.surfaces[side];
    resetContext(ctx);
    ctx.clearRect(0, 0, width, height);
    for (const op of composeOps(instances)) {
      if (op.modifiers.length === 0) {
        this.drawInstance(ctx, op.target.layer, surface, op.target.layer.opacity);
        continue;
      }
      // Hedef ara canvas'a çizilir, maskeler uygulanır, sonuç ana canvas'a basılır.
      const s = this.scratchFor(side, width, height);
      resetContext(s);
      s.clearRect(0, 0, width, height);
      this.drawInstance(s, op.target.layer, surface, op.target.layer.opacity);
      for (const m of op.modifiers) {
        s.globalCompositeOperation =
          m.layer.maskMode === 'cutout' ? 'destination-out' : 'destination-in';
        this.drawInstance(s, m.layer, surface, m.layer.opacity);
        s.globalCompositeOperation = 'source-over';
      }
      resetContext(ctx);
      ctx.drawImage(s.canvas, 0, 0);
    }
    resetContext(ctx);
    this.textures[side].needsUpdate = true;
  }

  private scratchFor(side: VinylSide, w: number, h: number): Ctx {
    let s = this.scratch[side];
    if (!s) {
      s = createContext(w, h);
      this.scratch[side] = s;
    }
    return s;
  }

  private drawInstance(
    ctx: Ctx,
    layer: VinylLayer,
    surface: ProjectionSurface,
    alpha: number,
  ): void {
    const { width, height } = ctx.canvas;
    ctx.globalAlpha = alpha;
    if (layer.shapeId === TEXT_SHAPE_ID) {
      const layout = this.layout(layer.text ?? '', layer.fontId);
      if (layout) drawStroke(ctx, layer, surface, width, height, layout);
      return;
    }
    const shape = getVinylShape(layer.shapeId);
    if (!shape) return;
    if (shape.kind === 'glyph') {
      const layout = this.layout(shape.char, undefined);
      if (layout) drawStroke(ctx, layer, surface, width, height, layout);
      return;
    }
    const path = this.path(shape.id, shape.path);
    const [a, b, c, d, e, f] = canvasTransform(layer, surface, width, height);
    ctx.setTransform(a, b, c, d, e, f);
    if (shape.kind === 'gradient') {
      // Soldan sağa solan renk (şekil koordinatlarında)
      const { r, g, b: bl } = hexToRgb(layer.color);
      const rgb = `${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(bl * 255)}`;
      const grad = ctx.createLinearGradient(-50, 0, 50, 0);
      grad.addColorStop(0, `rgba(${rgb},1)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = grad;
      ctx.fill(path);
      return;
    }
    ctx.fillStyle = layer.color;
    ctx.fill(path, shape.fillRule ?? 'nonzero');
  }

  private path(id: string, d: string): Path2D {
    let p = this.paths.get(id);
    if (!p) {
      p = new Path2D(d);
      this.paths.set(id, p);
    }
    return p;
  }

  private layout(text: string, fontId: string | undefined): TextLayout | null {
    const key = `${fontId ?? ''}|${text}`;
    if (!this.layouts.has(key)) this.layouts.set(key, layoutText(text, fontId));
    return this.layouts.get(key) ?? null;
  }

  dispose(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    // Yeniden kullanılırsa (React StrictMode) tüm yüzeyler baştan çizilsin.
    for (const side of VINYL_SIDES) this.last[side] = [];
    for (const side of VINYL_SIDES) this.textures[side].dispose();
  }
}

function createContext(w: number, h: number): Ctx {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  // GPU hızlandırmalı canvas (varsayılan): ölçümde doku yüklemesi ~0.1 ms; CPU canvas
  // (willReadFrequently) çizimi yüklemeye ertelediği için ~90 ms sürüyordu.
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Vinil canvas bağlamı alınamadı');
  return ctx;
}

function resetContext(ctx: Ctx): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Çizgi fontu (yazı/harf/rakam): çizgiler yüzey metresinde kurulur ve kalem kalınlığı da
 * metre cinsindendir; canvas metre -> piksel dönüşümünü uygular. Böylece yan yüzeylerin
 * kare olmayan piksellerinde de kalem fiziksel olarak eşit kalınlıkta görünür.
 */
function drawStroke(
  ctx: Ctx,
  layer: VinylLayer,
  surface: ProjectionSurface,
  width: number,
  height: number,
  layout: TextLayout,
): void {
  const m = layerTransform(layer, surface);
  const path = new Path2D();
  for (const line of layout.polylines) {
    line.forEach(([x, y], i) => {
      const [mx, my] = applyAffine(m, x, y);
      if (i === 0) path.moveTo(mx, my);
      else path.lineTo(mx, my);
    });
  }
  const kx = width / surface.widthM;
  const ky = height / surface.heightM;
  ctx.setTransform(kx, 0, 0, -ky, 0, height);
  ctx.lineWidth = layout.weight * Math.abs(layer.scale[1]) * vinylConfig.baseShapeSizeM;
  ctx.lineCap = layout.cap;
  ctx.lineJoin = layout.join;
  ctx.miterLimit = 4;
  ctx.strokeStyle = layer.color;
  ctx.stroke(path);
}

/** Kaynak katmanlar aynı nesne ve aynı sırada mı (değişmez güncellemeler sayesinde ucuz). */
function sameInstances(a: LayerInstance[], b: LayerInstance[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] as LayerInstance;
    const y = b[i] as LayerInstance;
    if (x.source !== y.source || x.mirrored !== y.mirrored) return false;
  }
  return true;
}
