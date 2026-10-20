import { useEffect, useMemo } from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  TorusGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeStaticMeshes } from '../../core/model/mergeStatic';
import { sceneConfig } from './sceneConfig';

/** Sarı-siyah çapraz tehlike şeridi dokusu (kapı eşiği, zemin bandı) */
function hazardTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#121214';
    ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = '#e8b21c';
    for (let x = -32; x < 160; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 32);
      ctx.lineTo(x + 16, 32);
      ctx.lineTo(x + 32, 0);
      ctx.lineTo(x + 16, 0);
      ctx.fill();
    }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

type Kit = {
  group: Group;
  add: (
    geometry: BufferGeometry,
    material: Material,
    position: [number, number, number],
    rotation?: [number, number, number],
  ) => void;
};

function createKit(): Kit {
  const group = new Group();
  return {
    group,
    add: (geometry, material, position, rotation = [0, 0, 0]) => {
      const m = new Mesh(geometry, material);
      m.position.set(...position);
      m.rotation.set(...rotation);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    },
  };
}

/**
 * Atölyeyi dolduran ayrıntılar: iki direkli lift, standda motor, kepenk kapı, lastik rafı,
 * aletli pano, kompresör, yangın tüpü ve zemin şeritleri. Hepsi bir kez kurulur ve materyale
 * göre birleştirilir: onlarca parça birkaç çizim çağrısına iner.
 */
export function GarageDetails() {
  const { root, dispose } = useMemo(() => {
    const r = sceneConfig.room;
    const hazard = hazardTexture();
    const hazardFloor = hazard.clone();
    hazardFloor.repeat.set(18, 1);
    hazardFloor.needsUpdate = true;
    const mats = {
      liftPaint: new MeshStandardMaterial({ color: '#c8461a', metalness: 0.4, roughness: 0.45 }),
      steel: new MeshStandardMaterial({ color: '#3a3e44', metalness: 0.75, roughness: 0.4 }),
      darkSteel: new MeshStandardMaterial({ color: '#1a1c20', metalness: 0.6, roughness: 0.5 }),
      engine: new MeshStandardMaterial({ color: '#5a5e66', metalness: 0.7, roughness: 0.35 }),
      rubber: new MeshStandardMaterial({ color: '#141416', roughness: 0.92 }),
      door: new MeshStandardMaterial({ color: '#8d939b', metalness: 0.55, roughness: 0.5 }),
      pegboard: new MeshStandardMaterial({ color: '#b39468', roughness: 0.85 }),
      red: new MeshStandardMaterial({ color: '#b0170f', metalness: 0.3, roughness: 0.4 }),
      hazard: new MeshStandardMaterial({ map: hazard, roughness: 0.7 }),
      floorHazard: new MeshStandardMaterial({ map: hazardFloor, roughness: 0.6 }),
      floorLine: new MeshStandardMaterial({ color: '#d8a51c', roughness: 0.6 }),
    };
    const geos: BufferGeometry[] = [];
    const g = <T extends BufferGeometry>(geometry: T): T => {
      geos.push(geometry);
      return geometry;
    };
    const kit = createKit();
    const { add } = kit;

    // --- İki direkli lift (arka sol)
    const lift = { x: -5.2, z: -7.6, span: 3.1, height: 3.6 };
    for (const s of [-1, 1]) {
      const x = lift.x + (s * lift.span) / 2;
      add(g(new BoxGeometry(0.28, lift.height, 0.36)), mats.liftPaint, [
        x,
        lift.height / 2,
        lift.z,
      ]);
      add(g(new BoxGeometry(0.7, 0.03, 0.7)), mats.darkSteel, [x, 0.015, lift.z]);
      // Kollar: zemine yakın, araca doğru açılı
      for (const d of [-1, 1])
        add(
          g(new BoxGeometry(1.2, 0.07, 0.12)),
          mats.steel,
          [x - s * 0.55, 0.18, lift.z + d * 0.45],
          [0, d * s * 0.35, 0],
        );
    }
    add(g(new BoxGeometry(lift.span + 0.28, 0.18, 0.26)), mats.liftPaint, [
      lift.x,
      lift.height + 0.09,
      lift.z,
    ]);

    // --- Standda motor bloğu (lift yanında)
    const eng = { x: -8.6, z: -6.8 };
    add(g(new BoxGeometry(0.62, 0.48, 0.72)), mats.engine, [eng.x, 0.95, eng.z]);
    for (const s of [-1, 1])
      add(
        g(new BoxGeometry(0.22, 0.16, 0.66)),
        mats.engine,
        [eng.x + s * 0.26, 1.24, eng.z],
        [0, 0, s * 0.5],
      );
    add(g(new CylinderGeometry(0.04, 0.04, 0.7, 10)), mats.liftPaint, [eng.x - 0.42, 0.62, eng.z]);
    add(
      g(new BoxGeometry(0.9, 0.05, 0.08)),
      mats.liftPaint,
      [eng.x - 0.42, 0.04, eng.z],
      [0, 0.6, 0],
    );
    add(
      g(new BoxGeometry(0.9, 0.05, 0.08)),
      mats.liftPaint,
      [eng.x - 0.42, 0.04, eng.z],
      [0, -0.6, 0],
    );

    // --- Kepenk kapı (sol duvar): kapalı panel, çerçeve ve tehlike şeritli eşik
    const door = { z: 3.2, width: 5.2, height: 4.4, x: -r.halfWidth + 0.03 };
    const slats = 16;
    for (let i = 0; i < slats; i++)
      add(g(new BoxGeometry(0.04, door.height / slats - 0.02, door.width)), mats.door, [
        door.x + 0.03,
        (i + 0.5) * (door.height / slats),
        door.z,
      ]);
    for (const s of [-1, 1])
      add(g(new BoxGeometry(0.16, door.height + 0.3, 0.2)), mats.darkSteel, [
        door.x + 0.08,
        (door.height + 0.3) / 2,
        door.z + (s * (door.width + 0.2)) / 2,
      ]);
    add(g(new BoxGeometry(0.16, 0.3, door.width + 0.4)), mats.darkSteel, [
      door.x + 0.08,
      door.height + 0.15,
      door.z,
    ]);
    add(g(new BoxGeometry(0.02, 0.12, door.width)), mats.hazard, [door.x + 0.07, 0.06, door.z]);

    // --- Yangın tüpü (kapı yanında)
    add(g(new CylinderGeometry(0.09, 0.09, 0.5, 14)), mats.red, [
      door.x + 0.15,
      1.35,
      door.z + door.width / 2 + 0.6,
    ]);

    // --- Lastik rafı (sağ duvar)
    const rack = { x: r.halfWidth - 0.55, z: 1.5, length: 4.2 };
    for (const y of [0.35, 1.25, 2.15])
      add(g(new BoxGeometry(0.7, 0.05, rack.length)), mats.steel, [rack.x, y, rack.z]);
    for (const dz of [-1, 0, 1])
      for (const dx of [-0.3, 0.3])
        add(g(new BoxGeometry(0.05, 2.4, 0.05)), mats.darkSteel, [
          rack.x + dx,
          1.2,
          rack.z + (dz * rack.length) / 2,
        ]);
    for (const y of [0.35, 1.25])
      for (let i = 0; i < 6; i++)
        add(
          g(new TorusGeometry(0.3, 0.11, 10, 22)),
          mats.rubber,
          [rack.x, y + 0.42, rack.z - rack.length / 2 + 0.38 + i * 0.68],
          [0, Math.PI / 2, 0],
        );

    // --- Aletli pano (tezgâhın üstü, arka duvar)
    const bench = sceneConfig.props.bench;
    const board = { x: bench.position[0], y: 2.2, z: -r.halfDepth + 0.04, w: 3.2, h: 1.3 };
    add(g(new BoxGeometry(board.w, board.h, 0.03)), mats.pegboard, [board.x, board.y, board.z]);
    for (let i = 0; i < 9; i++) {
      // Anahtar/tornavida silüetleri: farklı boylarda ince çubuklar
      const len = 0.22 + (i % 4) * 0.08;
      add(g(new BoxGeometry(0.035, len, 0.02)), mats.steel, [
        board.x - 1.3 + i * 0.32,
        board.y + 0.25,
        board.z + 0.03,
      ]);
    }
    for (let i = 0; i < 5; i++)
      add(g(new BoxGeometry(0.28, 0.06, 0.03)), mats.red, [
        board.x - 1.1 + i * 0.55,
        board.y - 0.32,
        board.z + 0.03,
      ]);
    add(g(new BoxGeometry(board.w, 0.04, 0.35)), mats.darkSteel, [
      board.x,
      board.y + board.h / 2 + 0.25,
      board.z + 0.17,
    ]);

    // --- Kompresör (takım dolabının yanı)
    const chest = sceneConfig.props.toolChest.position;
    const comp = { x: chest[0] + 1.6, z: chest[2] + 0.2 };
    add(
      g(new CylinderGeometry(0.24, 0.24, 0.9, 18)),
      mats.red,
      [comp.x, 0.38, comp.z],
      [0, 0, Math.PI / 2],
    );
    add(g(new BoxGeometry(0.4, 0.3, 0.3)), mats.darkSteel, [comp.x, 0.78, comp.z]);

    // --- Zemin: park şeritleri ve arka duvar önünde tehlike bandı (yansıyan zeminin hemen üstü)
    for (const s of [-1, 1])
      add(g(new BoxGeometry(0.12, 0.004, 7.5)), mats.floorLine, [s * 3.9, 0.003, 0]);
    add(g(new BoxGeometry(18, 0.004, 0.35)), mats.floorHazard, [0, 0.003, -r.halfDepth + 1.4]);

    const { group } = kit;
    mergeStaticMeshes(group);
    return {
      root: group,
      dispose: () => {
        group.traverse((o) => {
          if (o instanceof Mesh) o.geometry.dispose();
        });
        geos.forEach((x) => x.dispose());
        Object.values(mats).forEach((m) => m.dispose());
        hazard.dispose();
        hazardFloor.dispose();
      },
    };
  }, []);
  useEffect(() => dispose, [dispose]);
  return <primitive object={root} />;
}
