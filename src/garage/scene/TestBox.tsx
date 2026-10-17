import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { useAppStore } from '../../core/store/appStore';
import { sceneConfig } from './sceneConfig';

/** Faz 0 placeholder'ı: Faz 1'de CarRig ile değiştirilecek. */
export function TestBox() {
  const ref = useRef<Mesh>(null);
  const turntable = useAppStore((s) => s.turntable);
  const b = sceneConfig.testBox;

  useFrame((_, delta) => {
    if (turntable && ref.current) ref.current.rotation.y += delta * b.turntableSpeed;
  });

  return (
    <mesh ref={ref} position-y={b.size[1] / 2} castShadow>
      <boxGeometry args={b.size} />
      <meshPhysicalMaterial
        color={b.color}
        clearcoat={b.clearcoat}
        clearcoatRoughness={b.clearcoatRoughness}
        roughness={b.roughness}
        metalness={b.metalness}
      />
    </mesh>
  );
}
