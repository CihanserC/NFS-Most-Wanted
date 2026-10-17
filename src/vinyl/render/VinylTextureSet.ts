import { CanvasTexture, NoColorSpace } from 'three';
import {
  canvasTransform,
  instancesBySide,
  type LayerInstance,
  type ProjectionBox,
} from '../../core/vinyl/projection';
import { VINYL_SIDES, type VinylLayer, type VinylSide } from '../../core/vinyl/types';
import { vinylConfig } from '../../core/vinyl/projection';
import { getVinylShape } from '../shapes/library';

const ANISOTROPY = 8;

/**
 * Beş projeksiyon yüzeyinin canvas'ları ve dokuları. Katmanlar değişince sadece içeriği
 * değişen yüzeyler yeniden çizilir; birden fazla değişiklik tek animasyon karesinde
 * birleştirilir.
 */
export class VinylTextureSet {
  readonly textures: Record<VinylSide, CanvasTexture>;
  private readonly contexts: Record<VinylSide, CanvasRenderingContext2D>;
  private readonly last: Record<VinylSide, LayerInstance[]>;
  private pending: Record<VinylSide, LayerInstance[]> | null = null;
  private frame = 0;
  private readonly paths = new Map<string, Path2D>();
  /** Son yeniden çizimde çizilen yüzeyler (performans testi / hata ayıklama) */
  lastRedrawn: VinylSide[] = [];

  constructor(private readonly box: ProjectionBox) {
    const contexts = {} as Record<VinylSide, CanvasRenderingContext2D>;
    const textures = {} as Record<VinylSide, CanvasTexture>;
    const last = {} as Record<VinylSide, LayerInstance[]>;
    for (const side of VINYL_SIDES) {
      const [w, h] = vinylConfig.resolution[side];
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      // GPU hızlandırmalı canvas (varsayılan): ölçümde doku yüklemesi ~0.1 ms; CPU canvas
      // (willReadFrequently) çizimi yüklemeye ertelediği için ~90 ms sürüyordu.
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Vinil canvas bağlamı alınamadı');
      const tex = new CanvasTexture(canvas);
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

  private path(shapeId: string): { path: Path2D; rule: CanvasFillRule } | null {
    const shape = getVinylShape(shapeId);
    if (!shape) return null;
    let p = this.paths.get(shapeId);
    if (!p) {
      p = new Path2D(shape.path);
      this.paths.set(shapeId, p);
    }
    return { path: p, rule: shape.fillRule ?? 'nonzero' };
  }

  private draw(side: VinylSide, instances: LayerInstance[]): void {
    const ctx = this.contexts[side];
    const { width, height } = ctx.canvas;
    const surface = this.box.surfaces[side];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (const inst of instances) {
      const shape = this.path(inst.layer.shapeId);
      if (!shape) continue;
      const [a, b, c, d, e, f] = canvasTransform(inst.layer, surface, width, height);
      ctx.setTransform(a, b, c, d, e, f);
      ctx.globalAlpha = inst.layer.opacity;
      ctx.fillStyle = inst.layer.color;
      ctx.fill(shape.path, shape.rule);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    this.textures[side].needsUpdate = true;
  }

  dispose(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    // Yeniden kullanılırsa (React StrictMode) tüm yüzeyler baştan çizilsin.
    for (const side of VINYL_SIDES) this.last[side] = [];
    for (const side of VINYL_SIDES) this.textures[side].dispose();
  }
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
