import type { CarDefinition } from '../../data/cars';

/** Gövde üst yüzeyinin z'deki yüksekliği ve eğimi (parçayı yüzeye oturtmak için). */
export function deckPose(car: CarDefinition, z: number): { y: number; angle: number } {
  const h = 0.01;
  const slope = (car.body.deckY(z + h) - car.body.deckY(z - h)) / (2 * h);
  return { y: car.body.deckY(z), angle: -Math.atan(slope) };
}

export function roofPose(car: CarDefinition, z: number): { y: number; angle: number } {
  const h = 0.01;
  const slope = (car.body.roofY(z + h) - car.body.roofY(z - h)) / (2 * h);
  return { y: car.body.roofY(z), angle: -Math.atan(slope) };
}
