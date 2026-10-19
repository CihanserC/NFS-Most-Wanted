import { useMemo, type ReactNode } from 'react';
import { Quaternion, Vector3, type Material } from 'three';
import type { Vec3 } from '../../core/math/tuples';
import type { CarDefinition } from '../../data/cars';

export type SlotProps = {
  option: string;
  /** Önizleme dahil tüm etkin parçalar (bazı slotlar birbirine bağlı). */
  parts: Record<string, string>;
  car: CarDefinition;
  /** Gerçek modelin üstüne ek parça olarak mı çiziliyor (placeholder gövde değil) */
  onModel?: boolean;
};

const UP = new Vector3(0, 1, 0);

/** Sol/sağ simetrik parçalar: çocukları bir kez olduğu gibi, bir kez X'te aynalanmış çizer. */
export function Mirrored({ children }: { children: ReactNode }) {
  return (
    <>
      <group>{children}</group>
      <group scale={[-1, 1, 1]}>{children}</group>
    </>
  );
}

/** İki nokta arasında silindir (boru, çubuk). */
export function Bar({
  from,
  to,
  radius,
  material,
  segments = 12,
}: {
  from: Vec3;
  to: Vec3;
  radius: number;
  material: Material;
  segments?: number;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length();
    return {
      position: a.add(b).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(UP, dir.normalize()),
      length: len,
    };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} material={material} castShadow>
      <cylinderGeometry args={[radius, radius, length, segments]} />
    </mesh>
  );
}
