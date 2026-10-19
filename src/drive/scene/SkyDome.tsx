import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, ShaderMaterial, type Mesh, type Vector3 } from 'three';

const VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    // Sonsuzda: derinlik her zaman en uzak
    gl_Position.z = gl_Position.w * 0.99999;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 horizon;
  uniform vec3 zenith;
  uniform vec3 glow;
  uniform vec3 sunDir;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, 0.0, 1.0);
    vec3 col = mix(horizon, zenith, pow(h, 0.55));
    // Güneş çevresinde geniş, yumuşak sıcak ışıma (disk yok)
    float s = max(dot(d, normalize(sunDir)), 0.0);
    col += glow * (pow(s, 24.0) * 0.55 + pow(s, 6.0) * 0.25) * (1.0 - h * 0.6);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Kamerayı izleyen, derinlik kırpmasından etkilenmeyen gradyan gökyüzü kubbesi. */
export function SkyDome({
  horizon,
  zenith,
  glow,
  sunDirection,
}: {
  horizon: string;
  zenith: string;
  glow: string;
  sunDirection: Vector3;
}) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          horizon: { value: new Color(horizon) },
          zenith: { value: new Color(zenith) },
          glow: { value: new Color(glow) },
          sunDir: { value: sunDirection },
        },
      }),
    [horizon, zenith, glow, sunDirection],
  );
  useEffect(() => () => material.dispose(), [material]);
  const mesh = useRef<Mesh>(null);
  useFrame((state) => mesh.current?.position.copy(state.camera.position));
  return (
    <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={-1000}>
      <sphereGeometry args={[1000, 24, 16]} />
    </mesh>
  );
}
