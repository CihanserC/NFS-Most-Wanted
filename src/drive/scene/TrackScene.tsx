import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  CanvasTexture,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { barrierChains } from '../../core/drive/barriers';
import {
  buildScenery,
  GANTRY_PILLAR_M,
  type Grandstand,
  type StartGantry,
} from '../../core/drive/scenery';
import type { Track } from '../../core/drive/track';
import {
  ASPHALT_TILE_M,
  barrierWallGeometry,
  createAsphaltTexture,
  createCheckerTexture,
  createGantryBannerTexture,
  createGrassTexture,
  createKerbTexture,
  createVergeTexture,
  GRASS_TILE_M,
  KERB_TILE_M,
  ribbonGeometry,
  SURFACE_Y,
  VERGE_TILE_M,
} from './trackGeometry';

const GROUND_SIZE = 4000;
const BARRIER_HEIGHT = 1.2;
const BARRIER_THICKNESS = 0.8;
const LAMP_HEIGHT = 9;
const TREE_TRUNK = { radius: 0.25, height: 2 };
const TREE_CROWN = { radius: 1.6, height: 4.6 };
const OAK_CROWN_RADIUS = 2.3;
const GANTRY = { height: 7.2, beamHeight: 1.5, beamDepth: 1.1, pillar: GANTRY_PILLAR_M };
const START_LINE_DEPTH = 1.8;

const dummy = new Object3D();

function useDisposable<T extends { dispose: () => void }>(factory: () => T): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => factory(), []);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

function createCrowdTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#17181c';
    ctx.fillRect(0, 0, 128, 128);
    const colors = ['#d0302a', '#e8c030', '#3a7bd5', '#ecebe6', '#2fb36a', '#ff7a18'];
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)] as string;
      ctx.fillRect(Math.random() * 126, Math.random() * 126, 2, 3);
    }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

function Grandstands({ stands }: { stands: Grandstand[] }) {
  const crowd = useDisposable(createCrowdTexture);
  crowd.repeat.set(12, 1);
  const seat = useDisposable(
    () => new MeshStandardMaterial({ map: crowd, roughness: 0.9, metalness: 0 }),
  );
  const steel = useDisposable(
    () => new MeshStandardMaterial({ color: '#30343a', roughness: 0.6, metalness: 0.5 }),
  );
  return (
    <>
      {stands.map((g, i) => (
        <group key={i} position={[g.x, 0, g.z]} rotation-y={g.yaw}>
          {[0, 1, 2, 3].map((row) => (
            <mesh key={row} position={[0, 0.9 + row * 1.5, -row * 2.2]} material={seat} castShadow>
              <boxGeometry args={[g.length, 1.8 + row * 0.2, 2.2]} />
            </mesh>
          ))}
          <mesh position={[0, 8.4, -3.6]} material={steel} castShadow>
            <boxGeometry args={[g.length + 2, 0.4, 10]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (g.length / 2 + 0.6), 4.2, -3.6]} material={steel}>
              <boxGeometry args={[0.4, 8.4, 0.4]} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/** Başlangıç/bitiş: damalı çizgi + pisti kesen afişli kapı. */
function StartFinish({
  gantry,
  width,
  title,
}: {
  gantry: StartGantry;
  width: number;
  title: string;
}) {
  const checker = useDisposable(() => createCheckerTexture());
  const banner = useDisposable(() => createGantryBannerTexture(title));
  const lineMat = useDisposable(
    () => new MeshStandardMaterial({ map: checker, roughness: 0.8, metalness: 0 }),
  );
  const bannerMat = useDisposable(
    () =>
      new MeshStandardMaterial({
        map: banner,
        roughness: 0.6,
        metalness: 0,
        emissive: '#ffffff',
        emissiveMap: banner,
        emissiveIntensity: 0.35,
      }),
  );
  const steel = useDisposable(
    () => new MeshStandardMaterial({ color: '#2c3036', roughness: 0.5, metalness: 0.6 }),
  );
  const { span } = gantry;
  const beamY = GANTRY.height - GANTRY.beamHeight / 2;
  return (
    <group position={[gantry.x, 0, gantry.z]} rotation-y={gantry.yaw}>
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={SURFACE_Y.kerb + 0.001}
        material={lineMat}
        receiveShadow
      >
        <planeGeometry args={[width, START_LINE_DEPTH]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (span / 2), GANTRY.height / 2, 0]}
          material={steel}
          castShadow
        >
          <boxGeometry args={[GANTRY.pillar, GANTRY.height, GANTRY.pillar]} />
        </mesh>
      ))}
      <mesh position-y={beamY} material={steel} castShadow>
        <boxGeometry args={[span + GANTRY.pillar, GANTRY.beamHeight, GANTRY.beamDepth]} />
      </mesh>
      {/* Afiş iki yüzde: yaklaşan (-z) ve uzaklaşan (+z) taraf */}
      {[-1, 1].map((face) => (
        <mesh
          key={face}
          position={[0, beamY, face * (GANTRY.beamDepth / 2 + 0.01)]}
          rotation-y={face < 0 ? Math.PI : 0}
          material={bannerMat}
        >
          <planeGeometry args={[span - 0.4, GANTRY.beamHeight - 0.2]} />
        </mesh>
      ))}
    </group>
  );
}

/** Pist yüzeyi, kerbler, çim, bariyerler ve çevre (ağaç, kaya, direk, tribün, başlangıç kapısı). */
export function TrackScene({ track, night }: { track: Track; night: boolean }) {
  const half = track.widthM / 2;
  const kerb = track.config.kerbM;
  /** Biçilmiş çim şeridinin dış kenarı: bariyerin hemen altı */
  const vergeEdge = half + track.config.barrierOffsetM + 0.4;

  const asphaltTex = useDisposable(createAsphaltTexture);
  const kerbTex = useDisposable(createKerbTexture);
  const grassTex = useDisposable(createGrassTexture);
  const vergeTex = useDisposable(createVergeTexture);
  grassTex.repeat.set(GROUND_SIZE / GRASS_TILE_M, GROUND_SIZE / GRASS_TILE_M);

  const asphalt = useDisposable(
    () =>
      // Ortam yansıması düşük: sıyırma açısında asfalt ıslak gibi parlamasın
      new MeshStandardMaterial({
        map: asphaltTex,
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.25,
      }),
  );
  const kerbMat = useDisposable(
    () =>
      new MeshStandardMaterial({
        map: kerbTex,
        roughness: 0.85,
        metalness: 0,
        envMapIntensity: 0.4,
      }),
  );
  const grass = useDisposable(
    () => new MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 }),
  );
  const verge = useDisposable(
    () => new MeshStandardMaterial({ map: vergeTex, roughness: 1, metalness: 0 }),
  );
  const barrierMat = useDisposable(
    () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 }),
  );
  const trunkMat = useDisposable(
    () => new MeshStandardMaterial({ color: '#4a3524', roughness: 1 }),
  );
  const crownMat = useDisposable(
    () => new MeshStandardMaterial({ color: '#2f4a28', roughness: 1, flatShading: true }),
  );
  const oakMat = useDisposable(
    () => new MeshStandardMaterial({ color: '#4d6a2e', roughness: 1, flatShading: true }),
  );
  const rockMat = useDisposable(
    () => new MeshStandardMaterial({ color: '#7a6a58', roughness: 1, flatShading: true }),
  );
  const poleMat = useDisposable(
    () => new MeshStandardMaterial({ color: '#3a3e44', roughness: 0.6, metalness: 0.6 }),
  );
  const lampMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#ffe2a8').multiplyScalar(night ? 6 : 1.4),
        toneMapped: false,
      }),
    [night],
  );
  useEffect(() => () => lampMat.dispose(), [lampMat]);

  const geometries = useMemo(
    () => ({
      asphalt: ribbonGeometry(track, -half, half, SURFACE_Y.asphalt, ASPHALT_TILE_M),
      kerbLeft: ribbonGeometry(track, half, half + kerb, SURFACE_Y.kerb, KERB_TILE_M),
      kerbRight: ribbonGeometry(track, -half - kerb, -half, SURFACE_Y.kerb, KERB_TILE_M),
      vergeLeft: ribbonGeometry(track, half + kerb, vergeEdge, SURFACE_Y.verge, VERGE_TILE_M),
      vergeRight: ribbonGeometry(track, -vergeEdge, -half - kerb, SURFACE_Y.verge, VERGE_TILE_M),
    }),
    [track, half, kerb, vergeEdge],
  );
  useEffect(
    () => () => {
      for (const g of Object.values(geometries)) g.dispose();
    },
    [geometries],
  );

  // Bariyer duvarı: her kenar tek parça, kırmızı/beyaz segmentler örtüşmeden birleşir
  const barrierWalls = useMemo(() => {
    const chains = barrierChains(track);
    const colors = [new Color('#d0302a').toArray(), new Color('#ecebe6').toArray()] as const;
    return ([1, -1] as const).map((side) =>
      barrierWallGeometry(chains[side], BARRIER_THICKNESS, BARRIER_HEIGHT, colors),
    );
  }, [track]);
  useEffect(() => () => barrierWalls.forEach((g) => g.dispose()), [barrierWalls]);
  const scenery = useMemo(() => buildScenery(track), [track]);

  const trunkRef = useRef<InstancedMesh>(null);
  const crownRef = useRef<InstancedMesh>(null);
  const oakTrunkRef = useRef<InstancedMesh>(null);
  const oakCrownRef = useRef<InstancedMesh>(null);
  const rockRef = useRef<InstancedMesh>(null);
  const poleRef = useRef<InstancedMesh>(null);
  const lampRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const crown = crownRef.current;
    const oakTrunk = oakTrunkRef.current;
    const oakCrown = oakCrownRef.current;
    if (oakTrunk && oakCrown)
      scenery.oaks.forEach((t, i) => {
        const trunkH = TREE_TRUNK.height * 1.3 * t.scale;
        dummy.rotation.set(0, t.rotation, 0);
        dummy.scale.set(t.scale, t.scale * 1.3, t.scale);
        dummy.position.set(t.x, trunkH / 2, t.z);
        dummy.updateMatrix();
        oakTrunk.setMatrixAt(i, dummy.matrix);
        dummy.scale.set(t.scale * 1.1, t.scale * 0.9, t.scale);
        dummy.position.set(t.x, trunkH + OAK_CROWN_RADIUS * 0.6 * t.scale, t.z);
        dummy.updateMatrix();
        oakCrown.setMatrixAt(i, dummy.matrix);
      });
    if (trunk && crown)
      scenery.pines.forEach((t, i) => {
        dummy.rotation.set(0, t.rotation, 0);
        dummy.scale.setScalar(t.scale);
        dummy.position.set(t.x, (TREE_TRUNK.height / 2) * t.scale, t.z);
        dummy.updateMatrix();
        trunk.setMatrixAt(i, dummy.matrix);
        dummy.position.set(t.x, (TREE_TRUNK.height + TREE_CROWN.height / 2 - 0.4) * t.scale, t.z);
        dummy.updateMatrix();
        crown.setMatrixAt(i, dummy.matrix);
      });
    const rocks = rockRef.current;
    if (rocks)
      scenery.rocks.forEach((r, i) => {
        dummy.rotation.set(r.rotation * 0.3, r.rotation, r.rotation * 0.2);
        dummy.scale.set(r.scale * 1.4, r.scale * 0.9, r.scale);
        dummy.position.set(r.x, r.scale * 0.35, r.z);
        dummy.updateMatrix();
        rocks.setMatrixAt(i, dummy.matrix);
      });
    const poles = poleRef.current;
    const lamps = lampRef.current;
    if (poles && lamps)
      scenery.lamps.forEach((l, i) => {
        dummy.rotation.set(0, l.yaw, 0);
        dummy.scale.set(1, 1, 1);
        dummy.position.set(l.x, LAMP_HEIGHT / 2, l.z);
        dummy.updateMatrix();
        poles.setMatrixAt(i, dummy.matrix);
        // Kol pist yönüne uzanır; lamba başı kolun ucunda
        dummy.position.set(
          l.x + Math.sin(l.yaw) * 1.4,
          LAMP_HEIGHT + 0.1,
          l.z + Math.cos(l.yaw) * 1.4,
        );
        dummy.updateMatrix();
        lamps.setMatrixAt(i, dummy.matrix);
      });
    for (const ref of [trunkRef, crownRef, oakTrunkRef, oakCrownRef, rockRef, poleRef, lampRef])
      if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [scenery]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={SURFACE_Y.grass} material={grass} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      </mesh>
      <mesh geometry={geometries.vergeLeft} material={verge} receiveShadow />
      <mesh geometry={geometries.vergeRight} material={verge} receiveShadow />
      <mesh geometry={geometries.asphalt} material={asphalt} receiveShadow />
      <mesh geometry={geometries.kerbLeft} material={kerbMat} receiveShadow />
      <mesh geometry={geometries.kerbRight} material={kerbMat} receiveShadow />

      {barrierWalls.map((g, i) => (
        <mesh key={i} geometry={g} material={barrierMat} castShadow receiveShadow />
      ))}

      <instancedMesh
        ref={trunkRef}
        args={[undefined, undefined, scenery.pines.length]}
        material={trunkMat}
        castShadow
        frustumCulled={false}
      >
        <cylinderGeometry
          args={[TREE_TRUNK.radius, TREE_TRUNK.radius * 1.2, TREE_TRUNK.height, 6]}
        />
      </instancedMesh>
      <instancedMesh
        ref={crownRef}
        args={[undefined, undefined, scenery.pines.length]}
        material={crownMat}
        castShadow
        frustumCulled={false}
      >
        <coneGeometry args={[TREE_CROWN.radius, TREE_CROWN.height, 7]} />
      </instancedMesh>
      <instancedMesh
        ref={oakTrunkRef}
        args={[undefined, undefined, scenery.oaks.length]}
        material={trunkMat}
        castShadow
        frustumCulled={false}
      >
        <cylinderGeometry
          args={[TREE_TRUNK.radius, TREE_TRUNK.radius * 1.3, TREE_TRUNK.height, 6]}
        />
      </instancedMesh>
      <instancedMesh
        ref={oakCrownRef}
        args={[undefined, undefined, scenery.oaks.length]}
        material={oakMat}
        castShadow
        frustumCulled={false}
      >
        <icosahedronGeometry args={[OAK_CROWN_RADIUS, 1]} />
      </instancedMesh>
      <instancedMesh
        ref={rockRef}
        args={[undefined, undefined, scenery.rocks.length]}
        material={rockMat}
        castShadow
        frustumCulled={false}
      >
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>

      <instancedMesh
        ref={poleRef}
        args={[undefined, undefined, scenery.lamps.length]}
        material={poleMat}
        castShadow
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.14, 0.2, LAMP_HEIGHT, 8]} />
      </instancedMesh>
      <instancedMesh
        ref={lampRef}
        args={[undefined, undefined, scenery.lamps.length]}
        material={lampMat}
        frustumCulled={false}
      >
        <boxGeometry args={[0.7, 0.14, 0.5]} />
      </instancedMesh>

      <Grandstands stands={scenery.grandstands} />
      <StartFinish
        gantry={scenery.gantry}
        width={track.widthM + 2 * kerb}
        title={track.config.name.toUpperCase()}
      />
    </group>
  );
}
