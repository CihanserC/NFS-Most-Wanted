import { BufferGeometry, CylinderGeometry, ExtrudeGeometry, Shape } from 'three';
import { lruMemoize } from '../../../core/cache/lru';
import { brakeMetrics, WHEEL_DIM } from '../../../core/wheels/dimensions';
import type { BrakeConfig } from '../../../core/wheels/types';

export type BrakeGeometries = {
  disc: BufferGeometry;
  hat: BufferGeometry;
  /** +x yönünde ortalanmış kaliper; mesh dönüşüyle yerleştirilir. */
  caliper: BufferGeometry;
};

const DISC_SEGMENTS = 56;
const HAT_RATIO = 0.55;

function buildBrakes(b: BrakeConfig, discMm: number): BrakeGeometries {
  const m = brakeMetrics(b, discMm);

  const disc = new CylinderGeometry(
    m.discRadius,
    m.discRadius,
    WHEEL_DIM.discThickness,
    DISC_SEGMENTS,
  );
  disc.rotateX(Math.PI / 2);
  disc.translate(0, 0, m.discZ);

  // Disk ile göbek yüzeyi arasındaki "şapka".
  const hatLength = Math.abs(m.discZ);
  const hat = new CylinderGeometry(
    m.discRadius * HAT_RATIO,
    m.discRadius * HAT_RATIO,
    hatLength,
    32,
  );
  hat.rotateX(Math.PI / 2);
  hat.translate(0, 0, m.discZ / 2);

  // Kaliper: diskin dış kenarını saran halka dilimi.
  const half = m.caliperSpan / 2;
  const shape = new Shape();
  shape.absarc(0, 0, m.caliperOuterRadius, -half, half, false);
  shape.absarc(0, 0, m.caliperInnerRadius, half, -half, true);
  const caliper = new ExtrudeGeometry(shape, {
    depth: WHEEL_DIM.caliperDepth,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 16,
  });
  caliper.translate(0, 0, m.discZ - WHEEL_DIM.caliperDepth / 2);

  return { disc, hat, caliper };
}

export const getBrakeGeometry = lruMemoize(
  (b: BrakeConfig, discMm: number) => `${discMm}|${b.pistons}`,
  buildBrakes,
  {
    max: 16,
    onEvict: (g) => {
      g.disc.dispose();
      g.hat.dispose();
      g.caliper.dispose();
    },
  },
);
