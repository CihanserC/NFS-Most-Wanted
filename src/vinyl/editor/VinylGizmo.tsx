import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  type Group,
  type Mesh,
} from 'three';
import { useShallow } from 'zustand/react/shallow';
import { dragLayer, type GizmoHandle } from '../../core/vinyl/gizmo';
import {
  commonSide,
  selectionBounds,
  snapPosition,
  transformGroup,
  type GroupHandle,
} from '../../core/vinyl/group';
import { updateLayer } from '../../core/vinyl/layers';
import {
  carToSurface,
  layerCornersUV,
  surfaceToCar,
  vinylConfig,
  type ProjectionBox,
} from '../../core/vinyl/projection';
import type { VinylLayer, VinylSide } from '../../core/vinyl/types';
import { useAppStore } from '../../core/store/appStore';
import { useBuildStore } from '../../core/store/stores';
import { categoryKind } from '../../garage/ui/categories';
import { GIZMO_FLAG } from './gizmoFlag';

const GIZMO = {
  color: '#3df2ff',
  groupColor: '#ff7a18',
  handleColor: '#ffffff',
  rotateColor: '#ff7a18',
  skewColor: '#ffd23d',
  /** Tutamak yarıçapı = kamera uzaklığı × bu oran (ekranda sabit boy) */
  handleScreenRatio: 0.011,
  /** Döndürme tutamağının üst kenardan uzaklığı, kamera uzaklığı oranı */
  rotateOffsetRatio: 0.05,
  renderOrder: 1000,
};

type OrbitLike = { enabled: boolean };

/** Sürüklerken kamera döndürmesini kapatır/açar (hook dışı yardımcı). */
function setOrbitEnabled(controls: OrbitLike | null, enabled: boolean): void {
  if (controls) controls.enabled = enabled;
}
type UV = [number, number];
type DownEvent = { stopPropagation: () => void; nativeEvent: PointerEvent };
type DownHandler = (e: DownEvent) => void;

/**
 * Seçimin gizmo'su (projeksiyon düzleminde, car-space).
 * - Tek katman: taşı, köşelerden ölçek, döndür, eğ.
 * - Grup / çoklu seçim (aynı yüzde): taşı, döndür, eşit ölçek (sınır kutusu etrafında).
 */
export function VinylGizmo({ root, box }: { root: RefObject<Group | null>; box: ProjectionBox }) {
  const active = useAppStore((s) => categoryKind(s.categoryId) === 'vinyl');
  const ids = useAppStore((s) => s.selectedLayerIds);
  // Sadece seçili katmanlara abone: sürüklemede diğer katmanlar yeniden çizim tetiklemez.
  const selected = useBuildStore(
    useShallow((s) => {
      if (!active || ids.length === 0) return [] as VinylLayer[];
      const set = new Set(ids);
      return (s.vinylPreview ?? s.build.vinyl).filter((l) => set.has(l.id));
    }),
  );
  const visible = selected.filter((l) => l.visible);
  if (visible.length === 0) return null;
  if (visible.length === 1)
    return (
      <ReflectionHidden>
        <SingleGizmo layer={visible[0] as VinylLayer} root={root} box={box} />
      </ReflectionHidden>
    );
  const side = commonSide(
    visible,
    visible.map((l) => l.id),
  );
  if (!side) return null;
  return (
    <ReflectionHidden>
      <GroupGizmo layers={visible} side={side} root={root} box={box} />
    </ReflectionHidden>
  );
}

/**
 * Gizmo yalnızca ana kamerada çizilir: zemin yansıması aynalanmış (zemin altındaki) sanal kamerayla
 * çizildiği için orada renk/derinlik yazımı kapatılır. Meshler her commit'te taranır (seçim değişince
 * yenileri oluşur).
 */
function ReflectionHidden({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((object) => {
      if (!('isMesh' in object) || !object.isMesh || object.userData.reflectionHidden) return;
      const mesh = object as Mesh;
      mesh.userData.reflectionHidden = true;
      mesh.onBeforeRender = (_renderer, _scene, camera) => {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const mirrored = camera.position.y < 0;
        for (const material of materials) {
          // Malzemenin kendi ayarı korunur: taşıma alanı (colorWrite=false) ana kamerada da
          // görünmez kalmalı, yoksa vinilin önünde opak bir dikdörtgen çizilir.
          material.userData.colorWrite ??= material.colorWrite;
          material.userData.depthWrite ??= material.depthWrite;
          material.colorWrite = !mirrored && (material.userData.colorWrite as boolean);
          material.depthWrite = !mirrored && (material.userData.depthWrite as boolean);
        }
      };
    });
  });
  return <group ref={ref}>{children}</group>;
}

/** İmleç -> projeksiyon düzlemi -> (u, v) ve sürükleme yaşam döngüsü. */
function useDrag(root: RefObject<Group | null>, box: ProjectionBox, side: VinylSide) {
  const { camera, gl } = useThree();
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const surface = box.surfaces[side];

  const pointerUV = (clientX: number, clientY: number): UV | null => {
    const g = root.current;
    if (!g) return null;
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new Raycaster();
    ray.setFromCamera(ndc, camera);
    const n = new Vector3(...surface.planeNormal);
    const worldNormal = n.clone().transformDirection(g.matrixWorld);
    const worldPoint = g.localToWorld(n.multiplyScalar(surface.planeOffset));
    const hit = ray.ray.intersectPlane(
      new Plane().setFromNormalAndCoplanarPoint(worldNormal, worldPoint),
      new Vector3(),
    );
    if (!hit) return null;
    const p = g.worldToLocal(hit);
    return carToSurface(box, side, [p.x, p.y, p.z]);
  };

  /** Sürükleme başlatır; onMove her harekette yeni katman listesini (önizleme) üretir. */
  const start = (e: DownEvent, onMove: (startUV: UV, uv: UV, ev: PointerEvent) => VinylLayer[]) => {
    e.stopPropagation();
    const startUV = pointerUV(e.nativeEvent.clientX, e.nativeEvent.clientY);
    if (!startUV) return;
    setOrbitEnabled(controls, false);
    const move = (ev: PointerEvent) => {
      const uv = pointerUV(ev.clientX, ev.clientY);
      if (uv) useBuildStore.getState().previewVinyl(onMove(startUV, uv, ev));
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      setOrbitEnabled(controls, true);
      useBuildStore.getState().commitVinylPreview();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  return { surface, start };
}

function SingleGizmo({
  layer,
  root,
  box,
}: {
  layer: VinylLayer;
  root: RefObject<Group | null>;
  box: ProjectionBox;
}) {
  const { surface, start } = useDrag(root, box, layer.side);
  const cornersUV = layerCornersUV(layer, surface);
  const mid = (a: number, b: number): UV => {
    const p = cornersUV[a] as UV;
    const q = cornersUV[b] as UV;
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  };

  const begin = (handle: GizmoHandle) => (e: DownEvent) => {
    if (layer.locked) return;
    const base = useBuildStore.getState().build.vinyl;
    start(e, (startUV, uv, ev) => {
      const snap = useAppStore.getState().vinylSnap;
      let next = dragLayer(
        { handle, layer, startUV },
        surface,
        uv,
        ev.shiftKey || (snap && handle === 'rotate'),
      );
      if (snap && handle === 'move')
        next = {
          ...next,
          position: snapPosition(
            next.position,
            vinylConfig.snap.grid,
            vinylConfig.snap.centerTolerance,
          ),
        };
      return updateLayer(base, layer.id, next);
    });
  };

  return (
    <GizmoFrame
      root={root}
      box={box}
      side={layer.side}
      cornersUV={cornersUV}
      center={layer.position}
      color={GIZMO.color}
      locked={layer.locked}
      onMove={begin('move')}
      onScale={begin('scale')}
      onRotate={begin('rotate')}
      skew={{ top: mid(2, 3), right: mid(1, 2), onSkewX: begin('skewX'), onSkewY: begin('skewY') }}
    />
  );
}

function GroupGizmo({
  layers,
  side,
  root,
  box,
}: {
  layers: VinylLayer[];
  side: VinylSide;
  root: RefObject<Group | null>;
  box: ProjectionBox;
}) {
  const { surface, start } = useDrag(root, box, side);
  const ids = layers.map((l) => l.id);
  const b = selectionBounds(layers, ids, surface);
  if (!b) return null;
  const cornersUV: UV[] = [
    [b[0], b[1]],
    [b[2], b[1]],
    [b[2], b[3]],
    [b[0], b[3]],
  ];
  const locked = layers.some((l) => l.locked);

  const begin = (handle: GroupHandle) => (e: DownEvent) => {
    if (locked) return;
    const base = useBuildStore.getState().build.vinyl;
    start(e, (startUV, uv, ev) => {
      const snap = useAppStore.getState().vinylSnap;
      let target = uv;
      if (snap && handle === 'move') {
        // Kayma miktarını ızgaraya yakala
        const g = vinylConfig.snap.grid;
        target = [
          startUV[0] + Math.round((uv[0] - startUV[0]) / g) * g,
          startUV[1] + Math.round((uv[1] - startUV[1]) / g) * g,
        ];
      }
      const angle = ev.shiftKey || snap ? vinylConfig.snap.angleDeg : 0;
      return transformGroup(base, ids, surface, handle, startUV, target, angle);
    });
  };

  return (
    <GizmoFrame
      root={root}
      box={box}
      side={side}
      cornersUV={cornersUV}
      center={[(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]}
      color={GIZMO.groupColor}
      locked={locked}
      onMove={begin('move')}
      onScale={begin('scale')}
      onRotate={begin('rotate')}
    />
  );
}

/** Ortak çizim: dış çizgi, görünmez taşıma alanı ve tutamaklar. */
function GizmoFrame({
  root,
  box,
  side,
  cornersUV,
  center,
  color,
  locked,
  onMove,
  onScale,
  onRotate,
  skew,
}: {
  root: RefObject<Group | null>;
  box: ProjectionBox;
  side: VinylSide;
  cornersUV: UV[];
  center: UV;
  color: string;
  locked: boolean;
  onMove: DownHandler;
  onScale: DownHandler;
  onRotate: DownHandler;
  skew?: { top: UV; right: UV; onSkewX: DownHandler; onSkewY: DownHandler };
}) {
  const surface = box.surfaces[side];
  const toCar = (uv: UV) => new Vector3(...surfaceToCar(box, side, uv[0], uv[1]));
  const corners = cornersUV.map(toCar);
  const topMid = toCar([
    ((cornersUV[2] as UV)[0] + (cornersUV[3] as UV)[0]) / 2,
    ((cornersUV[2] as UV)[1] + (cornersUV[3] as UV)[1]) / 2,
  ]);
  const up = topMid.clone().sub(toCar(center)).normalize();

  // Kalıcı geometriler; sürüklerken sadece köşe konumları yerinde güncellenir.
  const { fill, outline } = useMemo(() => {
    const f = new BufferGeometry();
    f.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
    f.setIndex([0, 1, 2, 0, 2, 3]);
    const o = new BufferGeometry();
    o.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
    return { fill: f, outline: o };
  }, []);
  useEffect(
    () => () => {
      fill.dispose();
      outline.dispose();
    },
    [fill, outline],
  );
  useLayoutEffect(() => {
    for (const g of [fill, outline]) {
      const attr = g.getAttribute('position') as BufferAttribute;
      corners.forEach((c, i) => attr.setXYZ(i, c.x, c.y, c.z));
      attr.needsUpdate = true;
      g.computeBoundingSphere();
    }
  });

  // Kamera projeksiyon düzleminin arkasındaysa (aracın öbür yüzüne bakıyorsa) gizmo gizlenir;
  // derinlik testi kapalı olduğu için aksi halde araç içinden görünürdü.
  const group = useRef<Group>(null);
  useFrame(({ camera: cam }) => {
    const g = root.current;
    const gz = group.current;
    if (!g || !gz) return;
    const n = new Vector3(...surface.planeNormal);
    const planePoint = g.localToWorld(n.clone().multiplyScalar(surface.planeOffset));
    const worldNormal = n.transformDirection(g.matrixWorld);
    gz.visible = cam.position.clone().sub(planePoint).dot(worldNormal) > 0;
  });

  return (
    <group ref={group} userData={{ [GIZMO_FLAG]: true }}>
      <lineLoop geometry={outline} renderOrder={GIZMO.renderOrder}>
        <lineBasicMaterial color={color} depthTest={false} depthWrite={false} />
      </lineLoop>
      {/* Taşıma alanı: görünmez ama tıklanabilir, böylece vinil örtülmez. */}
      <mesh geometry={fill} renderOrder={GIZMO.renderOrder} onPointerDown={onMove}>
        <meshBasicMaterial colorWrite={false} depthTest={false} depthWrite={false} side={2} />
      </mesh>
      {!locked && (
        <>
          {corners.map((c, i) => (
            <Handle key={i} at={c} color={GIZMO.handleColor} onDown={onScale} />
          ))}
          {skew && (
            <Handle at={toCar(skew.top)} color={GIZMO.skewColor} onDown={skew.onSkewX} diamond />
          )}
          {skew && (
            <Handle at={toCar(skew.right)} color={GIZMO.skewColor} onDown={skew.onSkewY} diamond />
          )}
          <RotateHandle base={topMid} dir={up} onDown={onRotate} />
        </>
      )}
    </group>
  );
}

/** Kameraya uzaklıkla ölçeklenen (ekranda sabit boyutlu) tutamak. */
function Handle({
  at,
  color,
  onDown,
  diamond = false,
}: {
  at: Vector3;
  color: string;
  onDown: DownHandler;
  diamond?: boolean;
}) {
  const ref = useRef<Mesh>(null);
  useFrame(({ camera }) => {
    const m = ref.current;
    if (!m) return;
    const world = m.getWorldPosition(new Vector3());
    m.scale.setScalar(camera.position.distanceTo(world) * GIZMO.handleScreenRatio);
  });
  return (
    <mesh ref={ref} position={at} renderOrder={GIZMO.renderOrder + 1} onPointerDown={onDown}>
      {diamond ? <octahedronGeometry args={[1.3, 0]} /> : <sphereGeometry args={[1, 16, 12]} />}
      <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
    </mesh>
  );
}

/** Üst kenarın biraz dışında, kameraya uzaklıkla ölçeklenen döndürme tutamağı. */
function RotateHandle({ base, dir, onDown }: { base: Vector3; dir: Vector3; onDown: DownHandler }) {
  const ref = useRef<Group>(null);
  const knob = useRef<Mesh>(null);
  useFrame(({ camera }) => {
    const g = ref.current;
    const k = knob.current;
    if (!g || !k) return;
    const d = camera.position.distanceTo(g.getWorldPosition(new Vector3()));
    k.position.copy(dir).multiplyScalar(d * GIZMO.rotateOffsetRatio);
    k.scale.setScalar(d * GIZMO.handleScreenRatio * 1.2);
  });
  return (
    <group ref={ref} position={base}>
      <mesh ref={knob} renderOrder={GIZMO.renderOrder + 1} onPointerDown={onDown}>
        <torusGeometry args={[0.8, 0.3, 8, 20]} />
        <meshBasicMaterial color={GIZMO.rotateColor} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}
