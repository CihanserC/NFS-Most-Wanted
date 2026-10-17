import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group } from 'three';
import { useAppStore } from '../../core/store/appStore';
import { categoryKind } from '../ui/categories';
import { sceneConfig } from './sceneConfig';

const TWO_PI = Math.PI * 2;

/**
 * Menüde boşta beklerken aracı döndürür. Bir slot seçilince araç sıfır açıya
 * döner ki manifestteki (araç uzayındaki) kamera preset'leri doğru yere baksın.
 */
export function Turntable({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);
  const enabled = useAppStore((s) => s.turntable);
  const focused = useAppStore(
    (s) => s.slotId !== null || s.paintZone !== null || categoryKind(s.categoryId) === 'wheels',
  );
  const { speed, returnDamping } = sceneConfig.turntable;

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    if (enabled && !focused) {
      g.rotation.y = (g.rotation.y + delta * speed) % TWO_PI;
    } else if (focused) {
      // En kısa yoldan 0'a dön.
      const wrapped = MathUtils.euclideanModulo(g.rotation.y + Math.PI, TWO_PI) - Math.PI;
      g.rotation.y = MathUtils.damp(wrapped, 0, returnDamping, delta);
    }
  });

  return <group ref={ref}>{children}</group>;
}
