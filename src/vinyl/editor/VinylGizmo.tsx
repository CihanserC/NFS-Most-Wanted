import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
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
import { dragLayer, type DragStart, type GizmoHandle } from '../../core/vinyl/gizmo';
import { updateLayer } from '../../core/vinyl/layers';
import {
  carToSurface,
  layerCornersUV,
  surfaceToCar,
  type ProjectionBox,
} from '../../core/vinyl/projection';
import type { VinylLayer } from '../../core/vinyl/types';
import { useAppStore } from '../../core/store/appStore';
import { useBuildStore, useVinylLayer } from '../../core/store/stores';
import { categoryKind } from '../../garage/ui/categories';
import { GIZMO_FLAG } from './gizmoFlag';

const GIZMO = {
  color: '#3df2ff',
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

/** Seçili katmanın sınır kutusu ve tutamakları (projeksiyon düzleminde, car-space). */
export function VinylGizmo({ root, box }: { root: RefObject<Group | null>; box: ProjectionBox }) {
  const active = useAppStore((s) => categoryKind(s.categoryId) === 'vinyl');
  const selectedId = useAppStore((s) => s.selectedLayerId);
  // Sadece seçili katmana abone: sürüklemede diğer 200+ katman yeniden çizim tetiklemez.
  const layer = useVinylLayer(active ? selectedId : null);
  if (!layer || !layer.visible) return null;
  return <GizmoFor layer={layer} root={root} box={box} />;
}

function GizmoFor({
  layer,
  root,
  box,
}: {
  layer: VinylLayer;
  root: RefObject<Group | null>;
  box: ProjectionBox;
}) {
  const surface = box.surfaces[layer.side];
  const { camera, gl } = useThree();
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const toCar = (uv: [number, number]) =>
    new Vector3(...surfaceToCar(box, layer.side, uv[0], uv[1]));

  const cornersUV = layerCornersUV(layer, surface);
  const corners = cornersUV.map(toCar);
  const mid = (a: number, b: number): [number, number] => {
    const p = cornersUV[a] as [number, number];
    const q = cornersUV[b] as [number, number];
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  };
  const topMid = toCar(mid(2, 3));
  const rightMid = toCar(mid(1, 2));
  const center = toCar(layer.position);
  const up = topMid.clone().sub(center).normalize();

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

  /** Ekrandaki imleç -> projeksiyon düzlemi -> (u, v) */
  const pointerUV = (clientX: number, clientY: number): [number, number] | null => {
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
    return carToSurface(box, layer.side, [p.x, p.y, p.z]);
  };

  const begin =
    (handle: GizmoHandle) => (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
      if (layer.locked) return;
      e.stopPropagation();
      const startUV = pointerUV(e.nativeEvent.clientX, e.nativeEvent.clientY);
      if (!startUV) return;
      const start: DragStart = { handle, layer, startUV };
      const base = useBuildStore.getState().build.vinyl;
      if (controls) controls.enabled = false;
      const move = (ev: PointerEvent) => {
        const uv = pointerUV(ev.clientX, ev.clientY);
        if (!uv) return;
        const next = dragLayer(start, surface, uv, ev.shiftKey);
        useBuildStore.getState().previewVinyl(updateLayer(base, layer.id, next));
      };
      const end = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        if (controls) controls.enabled = true;
        useBuildStore.getState().commitVinylPreview();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    };

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
        <lineBasicMaterial color={GIZMO.color} depthTest={false} depthWrite={false} />
      </lineLoop>
      {/* Taşıma alanı: görünmez ama tıklanabilir, böylece vinil örtülmez. */}
      <mesh geometry={fill} renderOrder={GIZMO.renderOrder} onPointerDown={begin('move')}>
        <meshBasicMaterial colorWrite={false} depthTest={false} depthWrite={false} side={2} />
      </mesh>
      {!layer.locked && (
        <>
          {corners.map((c, i) => (
            <Handle key={i} at={c} color={GIZMO.handleColor} onDown={begin('scale')} />
          ))}
          <Handle at={topMid} color={GIZMO.skewColor} onDown={begin('skewX')} diamond />
          <Handle at={rightMid} color={GIZMO.skewColor} onDown={begin('skewY')} diamond />
          <RotateHandle base={topMid} dir={up} onDown={begin('rotate')} />
        </>
      )}
    </group>
  );
}

type DownHandler = (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => void;

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
