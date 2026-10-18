import type { Vec3 } from '../../core/math/tuples';
import type { CarDefinition } from '../../data/cars';

/** Egzoz boru yerleşimi (m). mechanical.tsx'teki çizimle aynı değerler. */
export const EXHAUST_LAYOUT = {
  y: 0.22,
  startZ: -1.7,
  tailOffset: 0.02,
  dualX: [0.55],
  quadX: [0.45, 0.62],
  side: { y: 0.28, out: 0.05, zFront: 0.95, zRear: -0.85 },
} as const;

export type Pipe = { from: Vec3; to: Vec3; visible: boolean };

export function exhaustPipes(option: string, sideX: number, halfLength: number): Pipe[] {
  const e = EXHAUST_LAYOUT;
  const tailZ = -halfLength - e.tailOffset;
  if (option === 'side_pipes') {
    const x = sideX + e.side.out;
    return [1, -1].map((s) => ({
      from: [s * x, e.side.y, e.side.zFront],
      to: [s * x, e.side.y, e.side.zRear],
      visible: true,
    }));
  }
  const xs = option === 'quad' ? e.quadX : e.dualX;
  return xs.flatMap((x) =>
    [1, -1].map((s) => ({
      from: [s * x, e.y, e.startZ] as Vec3,
      to: [s * x, e.y, tailZ] as Vec3,
      visible: false,
    })),
  );
}

/** Egzoz uçlarının araç uzayındaki konumu ve çıkış yönü (efektler için). */
export function exhaustTails(option: string, car: CarDefinition): { at: Vec3; direction: Vec3 }[] {
  return exhaustPipes(option, car.body.sideX(0, EXHAUST_LAYOUT.side.y), car.body.halfLength).map(
    (p) => {
      const d: Vec3 = [p.to[0] - p.from[0], p.to[1] - p.from[1], p.to[2] - p.from[2]];
      const len = Math.hypot(...d) || 1;
      return { at: p.to, direction: [d[0] / len, d[1] / len, d[2] / len] };
    },
  );
}
