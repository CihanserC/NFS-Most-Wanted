import { RoundedBox } from '@react-three/drei';
import { paintFor } from '../materials/carMaterials';
import { useCarMaterials } from '../materials/useCarMaterials';
import { Bar, Mirrored, type SlotProps } from './common';
import { deckHalfWidth, deckPose, hoodRearZ, restY, roofPose, sideX, tailZ, topY } from './pose';

/** Gövde üstü/yanı placeholder ölçüleri (m). */
const LAYOUT = {
  cowl: { length: 0.4, width: 0.72, rise: 0.07, opening: 0.045 },
  shaker: { fromHoodRear: 0.64, width: 0.42, height: 0.12, depth: 0.5, radius: 0.03 },
  cutoutTrim: { thickness: 0.02, height: 0.012 },
  skirts: {
    y: 0.27,
    slim: [0.03, 0.06] as const,
    proTouring: [0.05, 0.1] as const,
    aero: [0.045, 0.09] as const,
    blade: 0.015,
    bladeOut: 0.09,
    chromeY: 0.34,
  },
  flare: { mild: { tube: 0.03, spread: 1.6 }, widebody: { tube: 0.06, spread: 2.2 }, sideY: 0.6 },
  ducktail: { zFromTail: 0.24, width: 1.6, widthFill: 1, height: 0.05, depth: 0.3, kick: 0.25 },
  lip: { zFromTail: 0.06, width: 1.5, widthFill: 0.95, height: 0.025, depth: 0.09, kick: 0.4 },
  wing: { thickness: 0.025, aoa: -0.08 },
  louvers: { count: 9, inset: 0.95, chord: 0.07, thickness: 0.012, lift: 0.025, tilt: -0.3 },
  mirror: { z: 0.42, y: 1.0, out: 0.07, bulletRadius: 0.05, racing: [0.05, 0.075, 0.13] as const },
} as const;

const SKIRT_FRONT_GAP = 0.02;

export function Hood({ option, car }: SlotProps) {
  const m = useCarMaterials();
  const hoodPaint = paintFor(m, 'hood');

  if (option === 'cowl_induction') {
    const c = LAYOUT.cowl;
    // Kaputun arka kenarından öne doğru yükselen kabartma (ön cama dayanır)
    const zStart = hoodRearZ(car);
    const zc = zStart + c.length / 2;
    const pose = deckPose(car, zc);
    const pitch = pose.angle + Math.atan(c.rise / c.length);
    // Alt yüz ayak izinin en alçak noktasında: kavisli kaputta kenarlar havada kalmaz
    const bottom = restY(car, zc, c.length / 2, 0, c.width / 2);
    const height = pose.y - bottom + c.rise / 2;
    return (
      <group position={[0, bottom, zc]} rotation-x={pitch}>
        <mesh position-y={height / 2} material={hoodPaint} castShadow>
          <boxGeometry args={[c.width, height, c.length]} />
        </mesh>
        <mesh
          position={[0, height - c.opening * 0.4, -c.length / 2 - 0.001]}
          material={m.underbody}
        >
          <boxGeometry args={[c.width * 0.85, c.opening * 0.6, 0.004]} />
        </mesh>
      </group>
    );
  }

  if (option === 'shaker_scoop') {
    const s = LAYOUT.shaker;
    const z = hoodRearZ(car) + s.fromHoodRear;
    const pose = deckPose(car, z);
    const base = restY(car, z, s.depth / 2, 0, s.width / 2);
    return (
      <group position={[0, base + s.height / 2, z]} rotation-x={pose.angle}>
        <RoundedBox
          args={[s.width, s.height, s.depth]}
          radius={s.radius}
          material={m.blackTrim}
          castShadow
        />
        <mesh position={[0, 0, s.depth / 2 + 0.001]} material={m.underbody}>
          <boxGeometry args={[s.width * 0.8, s.height * 0.55, 0.004]} />
        </mesh>
      </group>
    );
  }

  if (option === 'blower_cutout') {
    const cut = car.body.profile.blowerCutout;
    const t = LAYOUT.cutoutTrim;
    const pose = deckPose(car, cut.zCenter);
    const w = cut.halfWidth * 2;
    const l = cut.halfLength * 2;
    return (
      <group position={[0, pose.y, cut.zCenter]} rotation-x={pose.angle}>
        {[1, -1].map((s) => (
          <mesh key={`z${s}`} position={[0, 0, (s * l) / 2]} material={m.chrome}>
            <boxGeometry args={[w + t.thickness * 2, t.height, t.thickness]} />
          </mesh>
        ))}
        {[1, -1].map((s) => (
          <mesh key={`x${s}`} position={[(s * w) / 2, 0, 0]} material={m.chrome}>
            <boxGeometry args={[t.thickness, t.height, l]} />
          </mesh>
        ))}
      </group>
    );
  }
  return null;
}

/** Marşpiyel ortak yerleşimi: ön ve arka tekerlek kemeri arasında, gövde yan yüzeyinde. */
function skirtSpan(car: SlotProps['car']) {
  const [front, rear] = car.body.wheelArches;
  if (!front || !rear) return null;
  const zFront = front.z - front.radius - SKIRT_FRONT_GAP;
  const zRear = rear.z + rear.radius + SKIRT_FRONT_GAP;
  return { zFront, zRear, zc: (zFront + zRear) / 2, len: zFront - zRear };
}

export function SideSkirts({ option, car }: SlotProps) {
  const m = useCarMaterials();
  const span = skirtSpan(car);
  if (option === 'none' || !span) return null;
  const s = LAYOUT.skirts;
  const { zRear, zc, len } = span;
  const paint = paintFor(m, 'body');
  const side = (y: number) => sideX(car, zc, y);

  if (option === 'chrome_rocker') {
    // Eşik üstünde ince krom çıta
    const y = s.chromeY;
    return (
      <Mirrored>
        <mesh position={[side(y) + 0.004, y, zc]} material={m.chrome}>
          <boxGeometry args={[0.008, 0.035, len]} />
        </mesh>
      </Mirrored>
    );
  }

  if (option === 'carbon_blade') {
    // Eşiğin altından dışa taşan yatay karbon bıçak + ince taşıyıcı
    const y = s.y - 0.035;
    const x = side(s.y);
    return (
      <Mirrored>
        <mesh position={[x + s.bladeOut / 2 - 0.02, y, zc]} material={m.carbon} castShadow>
          <boxGeometry args={[s.bladeOut, 0.012, len]} />
        </mesh>
        <mesh position={[x - 0.005, y + 0.025, zc]} material={m.blackTrim}>
          <boxGeometry args={[0.02, 0.05, len * 0.98]} />
        </mesh>
      </Mirrored>
    );
  }

  const [thickness, height] =
    option === 'slim' ? s.slim : option === 'aero_flick' ? s.aero : s.proTouring;
  const x = side(s.y) + thickness / 2 - 0.01;
  return (
    <Mirrored>
      <mesh position={[x, s.y, zc]} material={paint} castShadow>
        <boxGeometry args={[thickness, height, len]} />
      </mesh>
      {option === 'pro_touring' && (
        <mesh position={[x + thickness / 2, s.y - height / 2, zc]} material={m.blackTrim}>
          <boxGeometry args={[thickness, s.blade, len]} />
        </mesh>
      )}
      {option === 'aero_flick' && (
        <>
          <mesh position={[x + thickness / 2, s.y - height / 2, zc]} material={m.carbon}>
            <boxGeometry args={[thickness * 1.6, s.blade, len]} />
          </mesh>
          {/* Arka tekerlek önünde yukarı kıvrık kanatçık */}
          <mesh
            position={[x + thickness * 0.9, s.y + height * 0.2, zRear + 0.12]}
            rotation={[0, -0.35, 0.5]}
            material={m.carbon}
            castShadow
          >
            <boxGeometry args={[0.12, 0.01, 0.2]} />
          </mesh>
        </>
      )}
    </Mirrored>
  );
}

export function Fenders({ option, car }: SlotProps) {
  const m = useCarMaterials();
  if (option === 'stock') return null;
  const f = option === 'widebody' ? LAYOUT.flare.widebody : LAYOUT.flare.mild;
  const ARC_IN_YZ_PLANE = Math.PI / 2;
  return (
    <Mirrored>
      {car.body.wheelArches.map((a) => (
        <group
          key={a.z}
          position={[car.body.sideX(a.z, LAYOUT.flare.sideY), a.centerY, a.z]}
          scale={[f.spread, 1, 1]}
        >
          <mesh rotation-y={ARC_IN_YZ_PLANE} material={paintFor(m, 'body')} castShadow>
            <torusGeometry args={[a.radius + f.tube, f.tube, 10, 40, Math.PI]} />
          </mesh>
        </group>
      ))}
    </Mirrored>
  );
}

export function RearSpoiler({ option, car }: SlotProps) {
  const m = useCarMaterials();
  const paint = paintFor(m, 'body');
  // Bagaj kapağının arka kenarı: bagaj yüksekliğinin hemen altındaki en arka gövde noktası
  const deckRef = topY(car, -car.body.halfLength + 0.3);
  const tail = tailZ(car, deckRef - 0.03);

  if (option === 'lip' || option === 'ducktail') {
    const d = option === 'lip' ? LAYOUT.lip : LAYOUT.ducktail;
    const z = tail + d.zFromTail - d.depth / 2;
    const pose = deckPose(car, z);
    const width = Math.min(d.width, 2 * deckHalfWidth(car, z) * d.widthFill);
    const base = restY(car, z, d.depth / 2, 0, width / 2);
    return (
      <mesh
        position={[0, base + d.height / 2, z]}
        rotation-x={pose.angle + d.kick}
        material={paint}
        castShadow
      >
        <boxGeometry args={[width, d.height, d.depth]} />
      </mesh>
    );
  }

  const style = WING_STYLES[option];
  if (!style) return null;
  const w = LAYOUT.wing;
  const z = tail + style.zFromTail;
  const half = deckHalfWidth(car, z);
  const postX = Math.min(style.postX, half * 0.8);
  const width = Math.min(style.width, 2 * half + style.overhang);
  // Ayaklar kendi x'lerindeki bagaj yüzeyine basar; kanat o yükseklikten h kadar yukarıda
  const y = topY(car, z, postX);
  const h = style.height;
  const wingMat = style.material === 'carbon' ? m.carbon : paint;
  const postMat = style.material === 'paint' ? paint : m.blackTrim;
  return (
    <group position={[0, y, z]}>
      <Mirrored>
        {style.swanNeck ? (
          // Kuğu boynu: ayak bagajdan öne-yukarı çıkar, kanadı üstünden tutar
          <>
            <Bar
              from={[postX, 0, style.neckForward]}
              to={[postX, h + w.thickness + 0.05, 0.02]}
              radius={0.018}
              material={postMat}
            />
            <mesh position={[postX, h + w.thickness / 2 + 0.03, 0]} material={postMat}>
              <boxGeometry args={[0.03, 0.06, 0.08]} />
            </mesh>
          </>
        ) : (
          <mesh position={[postX, h / 2, 0]} material={postMat}>
            <boxGeometry args={[style.postWidth, h + 0.02, 0.08]} />
          </mesh>
        )}
        {style.endplate && (
          <mesh position={[width / 2, h, 0]} material={m.carbon}>
            <boxGeometry args={[0.01, style.endplate[0], style.endplate[1]]} />
          </mesh>
        )}
      </Mirrored>
      <mesh position-y={h} rotation-x={w.aoa} material={wingMat} castShadow>
        <boxGeometry args={[width, w.thickness, style.chord]} />
      </mesh>
    </group>
  );
}

type WingStyle = {
  zFromTail: number;
  height: number;
  chord: number;
  width: number;
  /** Bagaj genişliğinin dışına taşma payı (m) */
  overhang: number;
  postX: number;
  postWidth: number;
  material: 'paint' | 'carbon';
  /** Uç plaka [yükseklik, uzunluk] */
  endplate?: readonly [number, number];
  swanNeck?: boolean;
  /** Kuğu boynu ayağının kanada göre öne uzanması (m) */
  neckForward: number;
};

/** Kanat biçimleri: ölçüler aracın bagaj genişliği ve kenarına göre ayrıca sınırlanır. */
const WING_STYLES: Partial<Record<string, WingStyle>> = {
  pedestal: {
    zFromTail: 0.17,
    height: 0.085,
    chord: 0.2,
    width: 1.4,
    overhang: 0,
    postX: 0.45,
    postWidth: 0.06,
    material: 'paint',
    neckForward: 0,
  },
  classic_wing: {
    zFromTail: 0.22,
    height: 0.15,
    chord: 0.24,
    width: 1.6,
    overhang: 0.1,
    postX: 0.6,
    postWidth: 0.04,
    material: 'paint',
    neckForward: 0,
  },
  high_wing: {
    zFromTail: 0.22,
    height: 0.4,
    chord: 0.24,
    width: 1.6,
    overhang: 0.1,
    postX: 0.6,
    postWidth: 0.04,
    material: 'paint',
    endplate: [0.12, 0.3],
    neckForward: 0,
  },
  gt_wing: {
    zFromTail: 0.1,
    height: 0.3,
    chord: 0.3,
    width: 1.75,
    overhang: 0.25,
    postX: 0.42,
    postWidth: 0.03,
    material: 'carbon',
    endplate: [0.2, 0.38],
    swanNeck: true,
    neckForward: 0.22,
  },
};

export function RearLouvers({ option, car }: SlotProps) {
  const m = useCarMaterials();
  if (option !== 'classic') return null;
  const l = LAYOUT.louvers;
  const [zMin, zMax] = car.body.profile.cabin.rearGlass;
  return (
    <group>
      {Array.from({ length: l.count }, (_, i) => {
        const z = zMin + ((zMax - zMin) * (i + 0.5)) / l.count;
        const pose = roofPose(car, z);
        const width = 2 * car.body.cabinHalfWidth(z, 1) * l.inset;
        return (
          <mesh
            key={i}
            position={[0, pose.y + l.lift, z]}
            rotation-x={pose.angle + l.tilt}
            material={m.blackTrim}
          >
            <boxGeometry args={[width, l.thickness, l.chord]} />
          </mesh>
        );
      })}
    </group>
  );
}

export function Mirrors({ option, car }: SlotProps) {
  const m = useCarMaterials();
  const r = LAYOUT.mirror;
  const baseX = car.body.cabinHalfWidth(r.z, 0);
  const x = car.body.sideX(r.z, r.y) + r.out;
  const head =
    option === 'chrome_bullet' ? (
      <mesh scale={[1, 0.9, 1.8]} material={m.chrome} castShadow>
        <sphereGeometry args={[r.bulletRadius, 24, 16]} />
      </mesh>
    ) : (
      <RoundedBox
        args={[...r.racing]}
        radius={0.02}
        material={option === 'carbon' ? m.carbon : paintFor(m, 'mirrors')}
        castShadow
      />
    );
  return (
    <Mirrored>
      <Bar
        from={[baseX, r.y - 0.03, r.z + 0.02]}
        to={[x, r.y, r.z]}
        radius={0.01}
        material={m.blackTrim}
      />
      <group position={[x, r.y, r.z]}>{head}</group>
    </Mirrored>
  );
}

/** Tavan seçeneği gövde mesh'inin materyalini değiştirir (bkz. PlaceholderBody); ek geometri yok. */
export function Roof() {
  return null;
}
