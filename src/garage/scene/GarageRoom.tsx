import { useMemo } from 'react';
import { CatmullRomCurve3, Vector3 } from 'three';
import { hexToLinearRgb } from '../../core/color/color';
import { brickTextures, corrugatedNormal } from './garageTextures';
import { GarageDetails } from './GarageDetails';
import { sceneConfig } from './sceneConfig';

/**
 * Atölye odası: tuğla arka duvar, oluklu sac yan duvarlar, tavan kirişleri, görünür
 * ışık armatürleri (ortam haritasıyla aynı yerlerde), neon tabela ve aksesuarlar.
 * Hepsi basit geometri; atmosfer ışık ve post-processing ile sağlanır.
 */
export function GarageRoom() {
  return (
    <group>
      <Walls />
      <Ceiling />
      <CeilingStrips />
      <LightStands />
      <WallStrips />
      <NeonSign />
      <Props />
      <GarageDetails />
    </group>
  );
}

function Walls() {
  const r = sceneConfig.room;
  const brick = brickTextures(r.wallBrick.repeat);
  const metalNormal = corrugatedNormal(r.wallMetal.repeat);
  const w = r.halfWidth * 2;
  const d = r.halfDepth * 2;
  const y = r.height / 2;
  return (
    <group>
      {/* Arka ve ön duvar: tuğla */}
      <mesh position={[0, y, -r.halfDepth]} receiveShadow>
        <planeGeometry args={[w, r.height]} />
        <meshStandardMaterial
          color={r.wallBrick.color}
          map={brick.map}
          normalMap={brick.normalMap}
          roughness={0.9}
        />
      </mesh>
      <mesh position={[0, y, r.halfDepth]} rotation-y={Math.PI}>
        <planeGeometry args={[w, r.height]} />
        <meshStandardMaterial color={r.wallBrick.color} map={brick.map} roughness={0.9} />
      </mesh>
      {/* Yan duvarlar: oluklu sac */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * r.halfWidth, y, 0]} rotation-y={(-s * Math.PI) / 2}>
          <planeGeometry args={[d, r.height]} />
          <meshStandardMaterial
            color={r.wallMetal.color}
            normalMap={metalNormal}
            metalness={0.6}
            roughness={0.55}
          />
        </mesh>
      ))}
    </group>
  );
}

function Ceiling() {
  const r = sceneConfig.room;
  const b = r.beams;
  return (
    <group>
      <mesh position-y={r.height} rotation-x={Math.PI / 2}>
        <planeGeometry args={[r.halfWidth * 2, r.halfDepth * 2]} />
        <meshStandardMaterial color={r.ceilingColor} roughness={1} />
      </mesh>
      {Array.from({ length: b.count }, (_, i) => {
        const x = -r.halfWidth + ((i + 0.5) * (r.halfWidth * 2)) / b.count;
        return (
          <mesh key={i} position={[x, r.height - b.size[1] / 2, 0]}>
            <boxGeometry args={b.size} />
            <meshStandardMaterial color={b.color} metalness={0.5} roughness={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Tavandaki şerit softbox armatürler (boya yansımasındaki çizgilerin kaynağı). */
function CeilingStrips() {
  const s = sceneConfig.fixtures.ceilingStrip;
  return (
    <group>
      {sceneConfig.ceilingStripsZ.map((z) => (
        <group key={z} position={[0, s.y, z]}>
          <mesh position-y={s.depth / 2}>
            <boxGeometry args={[s.length + 0.1, s.depth, s.width + 0.08]} />
            <meshStandardMaterial color="#15161a" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh rotation-x={Math.PI / 2}>
            <planeGeometry args={[s.length, s.width]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
          {/* Bloom için HDR parlaklık */}
          <mesh rotation-x={Math.PI / 2} position-y={-0.002}>
            <planeGeometry args={[s.length * 0.98, s.width * 0.6]} />
            <meshBasicMaterial color={[s.intensity, s.intensity, s.intensity]} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Aracın iki yanındaki dikey LED stantlar. */
function LightStands() {
  const st = sceneConfig.lightStands;
  const f = sceneConfig.fixtures.standLight;
  return (
    <group>
      {st.z.flatMap((z) =>
        [1, -1].map((side) => (
          <group key={`${z}-${side}`} position={[side * st.x, 0, z]}>
            <mesh position-y={0.02}>
              <cylinderGeometry args={[f.baseRadius, f.baseRadius, 0.04, 24]} />
              <meshStandardMaterial color="#111215" metalness={0.7} roughness={0.4} />
            </mesh>
            <mesh position-y={st.centerY - st.height / 2 + 0.05}>
              <cylinderGeometry args={[f.poleRadius, f.poleRadius, 0.6, 12]} />
              <meshStandardMaterial color="#111215" metalness={0.7} roughness={0.4} />
            </mesh>
            <mesh position-y={st.centerY}>
              <cylinderGeometry args={[f.radius, f.radius, st.height, 16]} />
              <meshBasicMaterial
                color={[f.intensity, f.intensity, f.intensity]}
                toneMapped={false}
              />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

/** Yan duvarlarda alçak LED şeritler: sol sıcak turuncu, sağ soğuk turkuaz. */
function WallStrips() {
  const r = sceneConfig.room;
  const s = r.wallStrips;
  return (
    <group>
      {[
        { side: -1, color: r.warm },
        { side: 1, color: r.cool },
      ].map(({ side, color }) => (
        <mesh
          key={side}
          position={[side * (r.halfWidth - 0.02), s.y, 0]}
          rotation-y={(-side * Math.PI) / 2}
        >
          <planeGeometry args={[s.length, s.height]} />
          <meshBasicMaterial color={hexToLinearRgb(color, s.intensity)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Arka duvarda soyut neon tabela: hız çizgileri + şimşek (orijinal tasarım). */
function NeonSign() {
  const n = sceneConfig.neon;
  const tubes = useMemo(() => {
    const path = (pts: [number, number][]) =>
      new CatmullRomCurve3(
        pts.map(([x, y]) => new Vector3(x, y, 0)),
        false,
        'catmullrom',
        0.05,
      );
    return [
      {
        curve: path([
          [-2.4, 0.35],
          [-0.5, 0.35],
        ]),
        color: n.warm,
      },
      {
        curve: path([
          [-2.1, 0.05],
          [-0.7, 0.05],
        ]),
        color: n.warm,
      },
      {
        curve: path([
          [-1.8, -0.25],
          [-0.9, -0.25],
        ]),
        color: n.warm,
      },
      {
        curve: path([
          [0.5, 0.35],
          [2.4, 0.35],
        ]),
        color: n.cool,
      },
      {
        curve: path([
          [0.7, 0.05],
          [2.1, 0.05],
        ]),
        color: n.cool,
      },
      {
        curve: path([
          [0.9, -0.25],
          [1.8, -0.25],
        ]),
        color: n.cool,
      },
      // Şimşek
      {
        curve: path([
          [0.15, 0.75],
          [-0.25, 0.0],
          [0.12, 0.05],
          [-0.18, -0.75],
        ]),
        color: '#ffffff',
      },
    ];
  }, [n.cool, n.warm]);

  return (
    <group position={n.position}>
      {tubes.map((t, i) => {
        const c = hexToLinearRgb(t.color, n.intensity);
        return (
          <mesh key={i}>
            <tubeGeometry args={[t.curve, 48, n.tubeRadius, 8, false]} />
            <meshBasicMaterial color={c} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function Props() {
  const p = sceneConfig.props;
  return (
    <group>
      {/* Takım dolabı */}
      <group position={p.toolChest.position}>
        <mesh position-y={p.toolChest.size[1] / 2} castShadow>
          <boxGeometry args={p.toolChest.size} />
          <meshPhysicalMaterial
            color={p.toolChest.color}
            metalness={0.4}
            roughness={0.35}
            clearcoat={1}
          />
        </mesh>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} position={[0, 0.15 + i * 0.19, p.toolChest.size[2] / 2 + 0.005]}>
            <boxGeometry args={[p.toolChest.size[0] * 0.8, 0.015, 0.02]} />
            <meshStandardMaterial color="#c8ccd2" metalness={1} roughness={0.25} />
          </mesh>
        ))}
      </group>
      {/* Lastik yığınları */}
      {p.tireStacks.map((pos, i) => (
        <group key={i} position={pos}>
          {Array.from({ length: 4 - i }, (_, k) => (
            <mesh key={k} position-y={0.12 + k * 0.24} rotation-x={Math.PI / 2} castShadow>
              <torusGeometry args={[0.3, 0.12, 12, 28]} />
              <meshStandardMaterial color="#141416" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Yağ varilleri */}
      {p.drums.map((pos, i) => (
        <mesh key={i} position={[pos[0], 0.45, pos[2]]} castShadow>
          <cylinderGeometry args={[0.29, 0.29, 0.9, 24]} />
          <meshStandardMaterial color={p.drumColor} metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {/* Tezgah */}
      <group position={p.bench.position}>
        <mesh position-y={p.bench.size[1]} castShadow>
          <boxGeometry args={[p.bench.size[0], 0.06, p.bench.size[2]]} />
          <meshStandardMaterial color={p.bench.color} roughness={0.8} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * (p.bench.size[0] - 0.1)) / 2, p.bench.size[1] / 2, 0]}>
            <boxGeometry args={[0.06, p.bench.size[1], p.bench.size[2] - 0.1]} />
            <meshStandardMaterial color="#202226" metalness={0.6} roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
