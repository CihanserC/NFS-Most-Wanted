import type { AxleBody } from '../core/wheels/fitment';
import type { Axle } from '../core/wheels/types';
import type { CarDefinition } from '../data/cars';

const MM = 0.001;

/**
 * Fitment kontrolünün ihtiyaç duyduğu gövde ölçüleri. Çamurluk dudağı, tekerlek
 * merkezi yüksekliğindeki gövde yan yüzeyi + takılı çamurluk seçeneğinin taşması.
 */
export function axleBodies(
  car: CarDefinition,
  parts: Record<string, string>,
): Record<Axle, AxleBody> {
  const fenderOption = parts.fenders;
  const outset = fenderOption ? (car.parts.fenders?.[fenderOption]?.fenderOutsetMm ?? 0) : 0;
  const { wheels } = car.manifest;
  const [frontArch, rearArch] = car.body.wheelArches;
  const make = (pos: readonly number[], archRadius: number): AxleBody => {
    const [x = 0, y = 0, z = 0] = pos;
    return {
      hubX: Math.abs(x),
      stockRadius: y,
      archRadius,
      fenderX: car.body.sideX(z, y) + outset * MM,
      wellInnerX: car.body.profile.wellInnerX,
    };
  };
  return {
    front: make(wheels.FL.position, frontArch?.radius ?? wheels.FL.position[1]),
    rear: make(wheels.RL.position, rearArch?.radius ?? wheels.RL.position[1]),
  };
}

/** Takılı çamurluk tipinin izin verdiği en fazla spacer (mm); katalogda yoksa sınırsız. */
export function trackLimitMm(car: CarDefinition, parts: Record<string, string>): number {
  const option = parts.fenders;
  const limit = option ? car.parts.fenders?.[option]?.trackWidthLimitMm : undefined;
  return limit ?? Number.POSITIVE_INFINITY;
}
