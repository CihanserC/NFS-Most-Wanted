import { useEffect, useRef } from 'react';
import { useFrame, useStore, useThree } from '@react-three/fiber';
import { useGraphicsStore } from '../../core/store/graphicsStore';

/** Ölçüm penceresi (sn): UI'yı her karede güncellememek için. */
const WINDOW_SEC = 0.5;

/**
 * Kare hızını ve **tüm karenin** çizim istatistiklerini ölçer. Renderer sayaçları her çizimde
 * (efekt geçişleri dahil) sıfırlandığı için otomatik sıfırlama kapatılır: sayaçlar kare başında
 * sıfırlanır, kare sonunda okunur. Çizim yapmaz.
 */
export function FpsProbe() {
  const acc = useRef({ time: 0, frames: 0 });
  const three = useThree();
  const store = useStore();
  useEffect(() => {
    // Geliştirme: renderer/sahneyi konsoldan incelemek için.
    if (import.meta.env.DEV)
      Object.assign(window, {
        __muscleGarageThree: { gl: three.gl, scene: three.scene, camera: three.camera },
      });
  }, [three.gl, three.scene, three.camera]);
  useEffect(() => {
    const { info } = store.getState().gl;
    info.autoReset = false;
    return () => {
      info.autoReset = true;
    };
  }, [store]);

  useFrame(({ gl }) => gl.info.reset(), -100);
  // Efekt zincirinden (öncelik 1) ve fotoğraf köprüsünden (2) sonra: karenin tüm çizimleri sayılmış olur.
  useFrame(({ gl }, delta) => {
    const a = acc.current;
    a.time += delta;
    a.frames++;
    if (a.time >= WINDOW_SEC) {
      const { calls, triangles } = gl.info.render;
      useGraphicsStore.getState().setStats({
        fps: Math.round(a.frames / a.time),
        drawCalls: calls,
        triangles,
      });
      a.time = 0;
      a.frames = 0;
    }
  }, 100);
  return null;
}
