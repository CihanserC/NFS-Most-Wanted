import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, MeshBasicMaterial, type Mesh } from 'three';
import type { VehicleSnapshot } from '../physics/VehiclePhysics';

/** Halkadaki azami iz parçası sayısı; dolunca en eskisi üzerine yazılır. */
const MAX_QUADS = 2600;
const MARK_WIDTH = 0.26;
const MARK_Y = 0.026;
/** Bu kayma eşiğinin altında iz bırakılmaz */
const SLIP_THRESHOLD = 0.3;
/** Art arda iki iz noktası arasındaki en az mesafe (m) */
const MIN_SEGMENT = 0.3;
/** Bu mesafeden uzak sıçramada (ışınlanma) iz çizilmez */
const MAX_SEGMENT = 6;

type Point = { x: number; z: number };

/** Kayan tekerleklerin zeminde bıraktığı lastik izleri (tek geometri, halka tampon). */
export function SkidMarks({ snapshotRef }: { snapshotRef: RefObject<VehicleSnapshot | null> }) {
  const mesh = useRef<Mesh>(null);
  const state = useRef({ head: 0, prev: [null, null, null, null] as (Point | null)[] });

  const { geometry, material } = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(MAX_QUADS * 4 * 3), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(MAX_QUADS * 4 * 4), 4));
    const idx = new Uint32Array(MAX_QUADS * 6);
    for (let q = 0; q < MAX_QUADS; q++) {
      const v = q * 4;
      idx.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], q * 6);
    }
    g.setIndex(new BufferAttribute(idx, 1));
    const m = new MeshBasicMaterial({
      color: '#0a0a0a',
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    return { geometry: g, material: m };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    const snap = snapshotRef.current;
    const st = state.current;
    if (!snap) return;
    const pos = geometry.getAttribute('position') as BufferAttribute;
    const col = geometry.getAttribute('color') as BufferAttribute;
    let dirty = false;
    snap.wheels.forEach((w, i) => {
      const prev = st.prev[i] ?? null;
      if (!w.contact || w.slip < SLIP_THRESHOLD || w.surface === 'grass') {
        st.prev[i] = null;
        return;
      }
      const cur = { x: w.contactX, z: w.contactZ };
      if (!prev) {
        st.prev[i] = cur;
        return;
      }
      const dx = cur.x - prev.x;
      const dz = cur.z - prev.z;
      const len = Math.hypot(dx, dz);
      if (len > MAX_SEGMENT) {
        st.prev[i] = cur;
        return;
      }
      if (len < MIN_SEGMENT) return;
      const nx = (-dz / len) * (MARK_WIDTH / 2);
      const nz = (dx / len) * (MARK_WIDTH / 2);
      const q = st.head;
      st.head = (st.head + 1) % MAX_QUADS;
      const verts = [
        [prev.x - nx, prev.z - nz],
        [prev.x + nx, prev.z + nz],
        [cur.x - nx, cur.z - nz],
        [cur.x + nx, cur.z + nz],
      ];
      const alpha = Math.min(0.75, 0.25 + w.slip * 0.55);
      verts.forEach(([x, z], k) => {
        pos.setXYZ(q * 4 + k, x as number, MARK_Y, z as number);
        col.setXYZW(q * 4 + k, 1, 1, 1, alpha);
      });
      st.prev[i] = cur;
      dirty = true;
    });
    if (dirty) {
      pos.needsUpdate = true;
      col.needsUpdate = true;
    }
  });

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} />;
}
