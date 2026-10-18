import { useEffect, useRef } from 'react';
import { useFrame, useStore } from '@react-three/fiber';
import { clampPixelRatio, registerCapture } from './capture';

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
/** Piksel oranı değişince efekt zincirinin yeniden boyutlanıp bir kare çizmesi için beklenen kare sayısı */
const SETTLE_FRAMES = 4;

/** Renderer'ın tuvalini aynı karede 2D bir tuvale kopyalar (çizim tamponu sunulmadan okunur). */
function copyCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  out.getContext('2d')?.drawImage(source, 0, 0);
  return out;
}

/**
 * Canvas içinde çalışır: istenen kareyi post-processing sonrası yakalar. Yüksek çözünürlük için
 * piksel oranını geçici yükseltir, çekimden sonra eski değere döner.
 */
export function PhotoBridge() {
  const store = useStore();
  const waiting = useRef<((canvas: HTMLCanvasElement) => void)[]>([]);

  // Efekt zincirinden (öncelik 1) sonra çalışır: son kare tuvalde hazırdır.
  useFrame(({ gl }) => {
    if (waiting.current.length === 0) return;
    const copy = copyCanvas(gl.domElement);
    for (const resolve of waiting.current.splice(0)) resolve(copy);
  }, 2);

  useEffect(
    () =>
      registerCapture(async ({ pixelRatio }) => {
        const { gl, size, setDpr } = store.getState();
        const previous = gl.getPixelRatio();
        const target =
          pixelRatio === undefined
            ? previous
            : clampPixelRatio(pixelRatio, size.width, size.height);
        const changed = Math.abs(target - previous) > 0.01;
        if (changed) {
          setDpr(target);
          for (let i = 0; i < SETTLE_FRAMES; i++) await nextFrame();
        }
        try {
          return await new Promise<HTMLCanvasElement>((resolve) => waiting.current.push(resolve));
        } finally {
          if (changed) setDpr(previous);
        }
      }),
    [store],
  );

  return null;
}
