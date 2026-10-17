import { hexToLinearRgb } from '../../core/color/color';
import { shadowBlob, turntableDisc } from './garageTextures';
import { sceneConfig } from './sceneConfig';

const FLAT = -Math.PI / 2;
/** Zemin yansımasıyla z-fighting olmasın diye küçük yükseklikler (m). */
const LAYER = { disc: 0.002, ring: 0.003, shadow: 0.004 };

/**
 * Zemine gömülü döner tabla: koyu yarı saydam disk (zemin yansıması altından görünür),
 * turuncu LED halka ve aracın altındaki yumuşak gölge. Turntable grubunun içinde
 * olduğu için araçla birlikte döner.
 */
export function TurntableInlay() {
  const t = sceneConfig.turntable;
  const sh = sceneConfig.carShadow;
  const ring = hexToLinearRgb(t.ringColor, t.ringIntensity);
  return (
    <group>
      <mesh rotation-x={FLAT} position-y={LAYER.disc} receiveShadow>
        <circleGeometry args={[t.radius, 96]} />
        <meshStandardMaterial
          color="#0c0d10"
          alphaMap={turntableDisc(t.seams)}
          transparent
          opacity={t.discOpacity}
          metalness={0.8}
          roughness={0.3}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation-x={FLAT} position-y={LAYER.ring}>
        <ringGeometry args={[t.radius, t.radius + t.ringWidth, 128]} />
        <meshBasicMaterial color={ring} toneMapped={false} />
      </mesh>
      <mesh rotation-x={FLAT} position-y={LAYER.shadow}>
        <planeGeometry args={[sh.width, sh.length]} />
        <meshBasicMaterial
          color="#000000"
          alphaMap={shadowBlob()}
          transparent
          opacity={sh.opacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
