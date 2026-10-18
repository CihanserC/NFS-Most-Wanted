import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  NormalBlending,
  type PerspectiveCamera,
  type ShaderMaterial,
} from 'three';
import { ParticlePool } from './particles';

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

/** Havuzu çizen Points nesnesi. onFrame her karede emisyon yapabilir. */
export function ParticleSystem({
  capacity,
  additive,
  poolRef,
  onFrame,
  paused,
}: {
  capacity: number;
  additive: boolean;
  poolRef: RefObject<ParticlePool | null>;
  /** Havuz güncellenmeden önce çağrılır (emisyon burada yapılır) */
  onFrame: (pool: ParticlePool, dt: number) => void;
  paused: boolean;
}) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const instance = useMemo(() => new ParticlePool(capacity), [capacity]);
  const uniforms = useMemo(() => ({ uScale: { value: 1 } }), []);
  const materialRef = useRef<ShaderMaterial>(null);
  useEffect(() => {
    poolRef.current = instance;
    return () => {
      poolRef.current = null;
      instance.dispose();
    };
  }, [instance, poolRef]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (!paused) onFrame(instance, dt);
    instance.update(paused ? 0 : dt);
    const u = materialRef.current?.uniforms.uScale;
    if (u) u.value = (gl.domElement.height * 0.5) / Math.tan(((camera.fov ?? 60) * Math.PI) / 360);
  });

  return (
    <points geometry={instance.geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        transparent
        depthWrite={false}
        blending={additive ? AdditiveBlending : NormalBlending}
        uniforms={uniforms}
        toneMapped={false}
      />
    </points>
  );
}
