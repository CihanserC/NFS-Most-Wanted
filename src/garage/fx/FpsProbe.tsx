import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGraphicsStore } from '../../core/store/graphicsStore';

/** Ölçüm penceresi (sn): UI'yı her karede güncellememek için. */
const WINDOW_SEC = 0.5;

/** Kare hızını ve son karenin çizim istatistiklerini ölçer. Çizim yapmaz. */
export function FpsProbe() {
  const acc = useRef({ time: 0, frames: 0 });
  const three = useThree();
  useEffect(() => {
    // Geliştirme: renderer/sahneyi konsoldan incelemek için.
    if (import.meta.env.DEV)
      Object.assign(window, {
        __muscleGarageThree: { gl: three.gl, scene: three.scene, camera: three.camera },
      });
  }, [three.gl, three.scene, three.camera]);
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
  });
  return null;
}
