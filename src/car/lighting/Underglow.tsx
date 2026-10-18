import { useEffect, useMemo } from 'react';
import { AdditiveBlending, CanvasTexture, Color, MeshBasicMaterial } from 'three';
import { stanceData, type LightingConfig } from '../../core/stance/stance';
import type { CarDefinition } from '../../data/cars';

const GLOW_TEXTURE_SIZE = 128;
/** Marşpiyel neonu zeminden bu kadar yukarıda (m), gövde alçalınca onunla iner. */
const TUBE_HEIGHT = 0.14;
const DECAL_LIFT = 0.006;

/** Merkezden dışarı sönen yumuşak parlama dokusu (sRGB'ye bağlı değil, sadece alfa/parlaklık). */
function createGlowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GLOW_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = GLOW_TEXTURE_SIZE / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GLOW_TEXTURE_SIZE, GLOW_TEXTURE_SIZE);
  }
  return new CanvasTexture(canvas);
}

/**
 * Underglow: zeminde parlama, aracın altında neon tüpleri ve zemine yakın nokta ışıklar.
 * Gövdenin süspansiyonla indiği miktar (bodyLiftM) neon yüksekliğine yansır.
 */
export function Underglow({
  car,
  underglow,
  bodyLiftM,
}: {
  car: CarDefinition;
  underglow: LightingConfig['underglow'];
  bodyLiftM: number;
}) {
  const r = stanceData.underglowRender;
  const glowTexture = useMemo(() => createGlowTexture(), []);
  useEffect(() => () => glowTexture.dispose(), [glowTexture]);

  const color = useMemo(() => new Color(underglow.color), [underglow.color]);
  const decalMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        map: glowTexture,
        color,
        transparent: true,
        opacity: r.decalOpacity * underglow.intensity,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [glowTexture, color, underglow.intensity, r.decalOpacity],
  );
  useEffect(() => () => decalMaterial.dispose(), [decalMaterial]);

  const tubeMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: color.clone().multiplyScalar(r.tubeIntensity * (0.4 + underglow.intensity)),
        toneMapped: false,
      }),
    [color, underglow.intensity, r.tubeIntensity],
  );
  useEffect(() => () => tubeMaterial.dispose(), [tubeMaterial]);

  if (!underglow.enabled) return null;

  const { width, wheelbase } = car.manifest.dimensions;
  const tubeX = width / 2 - 0.22;
  const tubeY = Math.max(0.05, TUBE_HEIGHT + bodyLiftM);
  const lightZ = [wheelbase / 2 - 0.2, -(wheelbase / 2) + 0.2];

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={DECAL_LIFT} material={decalMaterial}>
        <planeGeometry args={[...r.decalScale]} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh
          key={s}
          position={[s * tubeX, tubeY, 0]}
          rotation-x={Math.PI / 2}
          material={tubeMaterial}
        >
          <cylinderGeometry args={[r.tubeRadius, r.tubeRadius, r.tubeLength, 8]} />
        </mesh>
      ))}
      {[1, -1].flatMap((s) =>
        lightZ.map((z) => (
          <pointLight
            key={`${s}${z}`}
            position={[s * tubeX * 0.7, tubeY - 0.04, z]}
            color={color}
            intensity={r.lightIntensity * underglow.intensity}
            distance={r.lightDistance}
            decay={2}
          />
        )),
      )}
    </group>
  );
}
